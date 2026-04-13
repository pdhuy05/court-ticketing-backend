const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const Counter = require('../models/counter.model');
const ServiceCounter = require('../models/serviceCounter.model');
const { TicketStatus } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const QRCode = require('qrcode');
const { emitDashboardUpdateSafe } = require('./dashboard.service');
const { writeBackup } = require('./ticket-backup.service');

const parseTargetDate = (dateString) => {
    if (!dateString) {
        return new Date();
    }

    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const getDateRange = (dateString) => {
    const targetDate = parseTargetDate(dateString);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const formattedDate = [
        start.getFullYear(),
        String(start.getMonth() + 1).padStart(2, '0'),
        String(start.getDate()).padStart(2, '0')
    ].join('-');

    return { start, end, formattedDate };
};

const emitStaffDisplayUpdateForCounters = async (counterIds, reason, extra = {}) => {
    if (!global.io || !counterIds?.length) {
        return;
    }

    const uniqueCounterIds = [...new Set(counterIds.map((counterId) => String(counterId)))];

    await Promise.all(
        uniqueCounterIds.map(async (counterId) => {
            try {
                const data = await getStaffDisplay(counterId);

                global.io.to(`counter-${counterId}`).emit('staff-display-updated', {
                    reason,
                    counterId,
                    updatedAt: new Date().toISOString(),
                    data,
                    ...extra
                });
            } catch (error) {
                console.error(`Không thể cập nhật staff display cho quầy ${counterId}: ${error.message}`);
            }
        })
    );
};

const createTicket = async ({ serviceId, name, phone }) => {
    const service = await Service.findById(serviceId);
    if (!service) throw new ApiError(404, 'Không tìm thấy dịch vụ');

    const availableCounters = await ServiceCounter
        .find({ serviceId, isActive: true })
        .populate('counterId');

    if (availableCounters.length === 0) {
        throw new ApiError(400, 'Dịch vụ này hiện chưa có quầy phục vụ.');
    }

    const lastTicket = await Ticket.findOne({ serviceId }).sort({ number: -1 });
    const nextNumber = lastTicket ? lastTicket.number + 1 : 1;
    const formattedNumber = nextNumber.toString().padStart(3, '0');

    const ticket = await Ticket.create({
        number: nextNumber,
        ticketNumber: formattedNumber,
        serviceId,
        name,
        phone,
        status: TicketStatus.WAITING,
        qrCode: null
    });

    const qrText = `SỐ THỨ TỰ: ${formattedNumber}
YÊU CẦU: ${service.name}
ĐƯƠNG SỰ: ${name}
ĐIỆN THOẠI: ${phone}
THỜI GIAN: ${new Date().toLocaleString('vi-VN')}`;
    
    let qrCode = null;
    try {
        qrCode = await QRCode.toDataURL(qrText, {
            errorCorrectionLevel: 'L',
            margin: 0,
            width: 100
        });
    } catch (err) {
        console.error('Lỗi tạo QR:', err.message);
    }

    if (qrCode) {
        ticket.qrCode = qrCode;
        await ticket.save();
    }

    await ticket.populate('serviceId', 'name code');

    if (global.io) {
        const waitingCount = await Ticket.countDocuments({ status: TicketStatus.WAITING });

        global.io.to('waiting-room').emit('new-ticket', {
            ticket: {
                id: ticket._id,
                number: ticket.number,
                formattedNumber,
                customerName: ticket.name,
                phone: ticket.phone,
                serviceName: service.name,
                status: ticket.status,
                qrCode: ticket.qrCode
            },
            totalWaiting: waitingCount
        });

        console.log(`\x1b[36m Đã phát hành vé mới: ${formattedNumber} - ${service.name}\x1b[0m`);
    }

    await emitStaffDisplayUpdateForCounters(
        availableCounters.map((counter) => counter._id),
        'ticket-created',
        {
            ticketId: ticket._id,
            serviceId: service._id
        }
    );

    await emitDashboardUpdateSafe('ticket-created');

    return {
        ticket,
        service,
        ticketNumberDisplay: formattedNumber,
        ticketNumberRaw: nextNumber,
        ticketNumberFormatted: formattedNumber,
        availableCounters: availableCounters.map(ac => ac.counterId),
        qrCode: ticket.qrCode
    };
};

const getAllWaiting = async () => {
    const tickets = await Ticket.find({ status: TicketStatus.WAITING })
        .populate('serviceId', 'name code')
        .sort({ weight: -1, number: 1 });

    return tickets.map(ticket => ({
        ...ticket.toObject(),
        formattedNumber: ticket.number.toString().padStart(3, '0')
    }));
};

const buildResetBackupPayload = async ({ type, label, tickets, counterIds, actor, criteria }) => {
    const [affectedCounters, services] = await Promise.all([
        counterIds.length
            ? Counter.find({ _id: { $in: counterIds } })
                .select('code name number isActive processedCount currentTicketId')
                .lean()
            : [],
        Service.find().select('code name isActive displayOrder').lean()
    ]);

    return writeBackup({
        type,
        label,
        payload: {
            criteria,
            actor: actor
                ? {
                    id: actor._id,
                    username: actor.username,
                    role: actor.role,
                    fullName: actor.fullName
                }
                : null,
            totals: {
                ticketCount: tickets.length,
                counterCount: counterIds.length
            },
            affectedCounters,
            services,
            tickets
        }
    });
};

const resetTicketsByDate = async (dateString, actor) => {
    const { start, end, formattedDate } = getDateRange(dateString);

    const tickets = await Ticket.find({
        createdAt: { $gte: start, $lt: end }
    }).lean();

    if (tickets.length === 0) {
        return {
            date: formattedDate,
            deletedCount: 0,
            counterCount: 0,
            backup: null
        };
    }

    const ticketIds = tickets.map(ticket => ticket._id);
    const counterIds = [
        ...new Set(
            tickets
                .filter(ticket => ticket.counterId)
                .map(ticket => String(ticket.counterId))
        )
    ];
    const serviceIds = [
        ...new Set(
            tickets
                .filter(ticket => ticket.serviceId)
                .map(ticket => String(ticket.serviceId))
        )
    ];
    const relatedCounterIds = serviceIds.length
        ? await ServiceCounter.find({
            serviceId: { $in: serviceIds },
            isActive: true
        }).distinct('counterId')
        : [];
    const affectedCounterIds = [...new Set([...counterIds, ...relatedCounterIds.map(String)])];
    const backup = await buildResetBackupPayload({
        type: 'reset-day',
        label: formattedDate,
        tickets,
        counterIds: affectedCounterIds,
        actor,
        criteria: {
            date: formattedDate,
            start,
            end
        }
    });

    await Counter.updateMany(
        { currentTicketId: { $in: ticketIds } },
        { currentTicketId: null }
    );

    await Ticket.deleteMany({
        _id: { $in: ticketIds }
    });

    if (global.io) {
        global.io.to('waiting-room').emit('tickets-reset-day', {
            date: formattedDate,
            deletedCount: ticketIds.length
        });

        counterIds.forEach((counterId) => {
            global.io.to(`counter-${counterId}`).emit('counter-reset', {
                counterId,
                date: formattedDate
            });
        });
    }

    await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-day', {
        date: formattedDate
    });

    await emitDashboardUpdateSafe('tickets-reset-day');

    return {
        date: formattedDate,
        deletedCount: ticketIds.length,
        counterCount: affectedCounterIds.length,
        backup
    };
};

const resetAllTickets = async (actor) => {
    const tickets = await Ticket.find({}).lean();
    const deletedCount = tickets.length;
    const counterIds = [
        ...new Set(
            tickets
                .filter(ticket => ticket.counterId)
                .map(ticket => String(ticket.counterId))
        )
    ];
    const relatedCounterIds = await ServiceCounter.find({ isActive: true }).distinct('counterId');
    const affectedCounterIds = [...new Set([...counterIds, ...relatedCounterIds.map(String)])];
    const backup = deletedCount
        ? await buildResetBackupPayload({
            type: 'reset-all',
            label: 'all-tickets',
            tickets,
            counterIds: affectedCounterIds,
            actor,
            criteria: {
                resetScope: 'all'
            }
        })
        : null;

    await Counter.updateMany({}, { currentTicketId: null });
    await Ticket.deleteMany({});

    if (global.io) {
        global.io.to('waiting-room').emit('tickets-reset-all', {
            deletedCount
        });

        global.io.emit('tickets-reset-all', {
            deletedCount
        });
    }

    await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-all', {
        deletedCount
    });

    await emitDashboardUpdateSafe('tickets-reset-all');

    return {
        deletedCount,
        backup
    };
};

const callNext = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter?.isActive) throw new ApiError(400, 'Quầy không tồn tại hoặc không hoạt động');

    const currentTicket = await Ticket.findOne({
        counterId,
        status: TicketStatus.PROCESSING
    });

    if (currentTicket) {
        throw new ApiError(400, `Quầy đang xử lý ticket ${String(currentTicket.number).padStart(3, '0')}. Vui lòng hoàn thành hoặc bỏ qua trước khi gọi số mới.`);
    }

    const serviceIds = await ServiceCounter.find({ counterId, isActive: true })
        .distinct('serviceId');
    
    if (serviceIds.length === 0) {
        throw new ApiError(400, 'Quầy chưa được gán dịch vụ');
    }

    const nextTicket = await Ticket.findOneAndUpdate(
        { 
            serviceId: { $in: serviceIds }, 
            status: TicketStatus.WAITING, 
            counterId: null 
        },
        { 
            status: TicketStatus.PROCESSING, 
            counterId, 
            processingAt: new Date() 
        },
        { sort: { weight: -1, number: 1 }, returnDocument: 'after' } 
    ).populate('serviceId', 'name code');

    if (!nextTicket) {
        throw new ApiError(404, 'Không có ticket đang chờ');
    }

    const serviceCounter = await ServiceCounter.findOne({ 
        serviceId: nextTicket.serviceId._id, 
        counterId 
    });
    if (serviceCounter) {
        nextTicket.serviceCounterId = serviceCounter._id;
        await nextTicket.save();
    }

    counter.currentTicketId = nextTicket._id;
    await counter.save();

    if (global.io) {
        const formattedNumberCall = String(nextTicket.number).padStart(3, '0');
        
        global.io.to('waiting-room').emit('ticket-called', {
            ticket: {
                id: nextTicket._id,
                number: nextTicket.number,
                formattedNumber: formattedNumberCall,
                customerName: nextTicket.name,
                serviceName: nextTicket.serviceId.name
            },
            counterName: counter.name,
            counterId: counter._id,
            calledAt: new Date()
        });
        
        global.io.to(`counter-${counterId}`).emit('new-current-ticket', {
            currentTicket: {
                id: nextTicket._id,
                number: nextTicket.number,
                formattedNumber: formattedNumberCall,
                customerName: nextTicket.name,
                phone: nextTicket.phone,
                serviceName: nextTicket.serviceId.name,
                status: 'processing'
            }
        });
        
    }

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-called', {
        ticketId: nextTicket._id
    });

    await emitDashboardUpdateSafe('ticket-called');

    return {
        nextTicket: {
            ...nextTicket.toObject(),
            formattedNumber: String(nextTicket.number).padStart(3, '0')
        },
        counter
    };
};

const completeTicket = async (id) => {
    const ticket = await Ticket.findById(id).populate('serviceId', 'name code');
    if (!ticket) throw new ApiError(404, 'Không tìm thấy ticket');
    if (ticket.status !== TicketStatus.PROCESSING) throw new ApiError(400, 'Ticket không ở trạng thái đang xử lý');

    ticket.status = TicketStatus.COMPLETED;
    ticket.completedAt = new Date();
    ticket.qrCode = null;
    await ticket.save();

    if (global.io) {
        const formattedNumberComplete = String(ticket.number).padStart(3, '0');
        
        global.io.to('waiting-room').emit('ticket-completed', {
            ticketId: ticket._id,
            number: ticket.number,
            formattedNumber: formattedNumberComplete,
            customerName: ticket.name,
            completedAt: new Date()
        });
        
        if (ticket.counterId) {
            global.io.to(`counter-${ticket.counterId}`).emit('ticket-finished', {
            ticketId: ticket._id,
            formattedNumber: formattedNumberComplete
            });
        }
        
        console.log(`\x1b[32m Vé đã được phát hành - hoàn tất: ${formattedNumberComplete}\x1b[0m`);
    }

    if (ticket.counterId) {
        await Counter.findByIdAndUpdate(ticket.counterId, {
            currentTicketId: null,
            $inc: { processedCount: 1 }
        });

        await emitStaffDisplayUpdateForCounters([ticket.counterId], 'ticket-completed', {
            ticketId: ticket._id
        });
    }

    await emitDashboardUpdateSafe('ticket-completed');

    return {
        ...ticket.toObject(),
        formattedNumber: ticket.number.toString().padStart(3, '0')
    };
};

const skipTicket = async (id, reason = '') => {
    const ticket = await Ticket.findById(id).populate('serviceId', 'name code');
    if (!ticket) throw new ApiError(404, 'Không tìm thấy ticket');
    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, 'Chỉ có thể bỏ qua ticket đang xử lý');
    }

    const currentCounterId = ticket.counterId;

    ticket.skipCount = (ticket.skipCount || 0) + 1;
    ticket.weight = -10 * ticket.skipCount;  
    
    if (ticket.skipCount >= 3) {
        ticket.status = TicketStatus.SKIPPED;
        ticket.qrCode = null;
    } else {
        ticket.status = TicketStatus.WAITING;
        ticket.counterId = null;
        ticket.serviceCounterId = null;
        ticket.processingAt = null;
    }
    
    if (reason) {
        ticket.note = reason;
    }
    await ticket.save();

    if (currentCounterId) {
        await Counter.findByIdAndUpdate(currentCounterId, { currentTicketId: null });
    }

    if (global.io) {
        const formattedNumberSkip = String(ticket.number).padStart(3, '0');
        
        global.io.to('waiting-room').emit('ticket-skipped', {
            ticketId: ticket._id,
            number: ticket.number,
            formattedNumber: formattedNumberSkip,
            customerName: ticket.name,
            skipCount: ticket.skipCount,
            weight: ticket.weight
        });
        
        if (currentCounterId) {
            global.io.to(`counter-${currentCounterId}`).emit('ticket-skipped', {
                ticketId: ticket._id,
                formattedNumber: formattedNumberSkip
            });
        }
    }

    const relatedCounterIds = await ServiceCounter.find({
        serviceId: ticket.serviceId._id,
        isActive: true
    }).distinct('counterId');

    await emitStaffDisplayUpdateForCounters(
        currentCounterId
            ? [...new Set([String(currentCounterId), ...relatedCounterIds.map(String)])]
            : relatedCounterIds,
        'ticket-skipped',
        {
            ticketId: ticket._id
        }
    );

    await emitDashboardUpdateSafe('ticket-skipped');

    return {
        ...ticket.toObject(),
        formattedNumber: ticket.number.toString().padStart(3, '0')
    };
};

const getCounterDisplay = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter) throw new ApiError(404, 'Không tìm thấy quầy');

    const serviceRelations = await ServiceCounter.find({ 
        counterId, 
        isActive: true 
    }).populate('serviceId', 'name code');

    const serviceIds = serviceRelations.map(rel => rel.serviceId._id);

    const waitingTickets = await Ticket.find({
        serviceId: { $in: serviceIds },
        status: TicketStatus.WAITING
    })
    .populate('serviceId', 'name code')
    .sort({ weight: -1, createdAt: 1, number: 1 })
    .limit(10);

    let currentTicket = null;
    if (counter.currentTicketId) {
        currentTicket = await Ticket.findById(counter.currentTicketId)
            .populate('serviceId', 'name code');
    }

    const formatTicket = (ticket) => ({
        id: ticket._id,
        number: ticket.number,
        formattedNumber: String(ticket.number).padStart(3, '0'),
        customerName: ticket.name,
        phone: ticket.phone,
        status: ticket.status,
        serviceName: ticket.serviceId?.name
    });

    return {
        counter: {
            id: counter._id,
            name: counter.name,
            number: counter.number,
            isActive: counter.isActive,
            processedCount: counter.processedCount
        },
        services: serviceRelations.map(rel => ({
            id: rel.serviceId._id,
            name: rel.serviceId.name,
            code: rel.serviceId.code
        })),
        currentTicket: currentTicket ? formatTicket(currentTicket) : null,
        waitingTickets: waitingTickets.map(formatTicket),
        totalWaiting: waitingTickets.length
    };
};

const getMyCounter = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter) {
        throw new ApiError(404, 'Không tìm thấy quầy của bạn');
    }

    const serviceRelations = await ServiceCounter.find({ 
        counterId, 
        isActive: true 
    }).populate('serviceId', 'name code');

    let currentTicket = null;
    if (counter.currentTicketId) {
        currentTicket = await Ticket.findById(counter.currentTicketId)
            .populate('serviceId', 'name code');
    }

    return {
        counter: {
            id: counter._id,
            name: counter.name,
            number: counter.number,
            processedCount: counter.processedCount,
            isActive: counter.isActive
        },
        services: serviceRelations.map(rel => ({
            id: rel.serviceId._id,
            name: rel.serviceId.name,
            code: rel.serviceId.code
        })),
        currentTicket: currentTicket ? {
            id: currentTicket._id,
            number: currentTicket.number,
            formattedNumber: currentTicket.number.toString().padStart(3, '0'),
            customerName: currentTicket.name,
            phone: currentTicket.phone,
            serviceName: currentTicket.serviceId?.name,
            status: currentTicket.status
        } : null
    };
};

const getStaffDisplay = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter) throw new ApiError(404, 'Không tìm thấy quầy');

    const serviceRelations = await ServiceCounter.find({ 
        counterId, 
        isActive: true 
    }).populate('serviceId', 'name code');

    const serviceIds = serviceRelations.map(rel => rel.serviceId._id);

    const waitingTickets = await Ticket.find({
        serviceId: { $in: serviceIds },
        status: TicketStatus.WAITING
    })
    .populate('serviceId', 'name code')
    .sort({ weight: -1, createdAt: 1, number: 1 })
    .limit(10);

    let currentTicket = null;
    if (counter.currentTicketId) {
        currentTicket = await Ticket.findById(counter.currentTicketId)
            .populate('serviceId', 'name code');
    }

    const formatTicket = (ticket) => ({
        id: ticket._id,
        number: ticket.number,
        formattedNumber: String(ticket.number).padStart(3, '0'),
        customerName: ticket.name,
        phone: ticket.phone,
        status: ticket.status,
        serviceName: ticket.serviceId?.name,
        createdAt: ticket.createdAt
    });

    return {
        counter: {
            id: counter._id,
            name: counter.name,
            number: counter.number,
            isActive: counter.isActive,
            processedCount: counter.processedCount
        },
        services: serviceRelations.map(rel => ({
            id: rel.serviceId._id,
            name: rel.serviceId.name,
            code: rel.serviceId.code
        })),
        currentTicket: currentTicket ? formatTicket(currentTicket) : null,
        waitingTickets: waitingTickets.map(formatTicket),
        totalWaiting: waitingTickets.length
    };
};

module.exports = {
    createTicket,
    getAllWaiting,
    resetTicketsByDate,
    resetAllTickets,
    callNext,
    completeTicket,
    skipTicket,
    getCounterDisplay,
    getMyCounter,
    getStaffDisplay,
};
