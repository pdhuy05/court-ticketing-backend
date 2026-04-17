const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const Counter = require('../models/counter.model');
const User = require('../models/user.model');
const ServiceCounter = require('../models/serviceCounter.model');
const CounterSequence = require('../models/counterSequence.model');
const { TicketStatus } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const { emitDashboardUpdateSafe } = require('./dashboard.service');
const { writeBackup } = require('./ticket-backup.service');
const { generateQRData, verifyQRData } = require('../utils/qrData.util');
const {
    getStaffServiceAccess,
    assertStaffCanHandleService
} = require('./staff-permission.service');

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

const normalizeCounterId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value._id) {
        return String(value._id);
    }

    return String(value);
};

const extractCounterIdsFromRelations = (relations = []) => {
    return relations
        .map((relation) => normalizeCounterId(relation.counterId))
        .filter(Boolean);
};

const formatQueueNumber = (number) => String(number).padStart(3, '0');

const formatDisplayNumber = (counterNumber, ticketNumber) => {
    if (!counterNumber) {
        return formatQueueNumber(ticketNumber);
    }

    return `${counterNumber}${formatQueueNumber(ticketNumber)}`;
};

const getPrimaryCounter = (counterRefs = []) => {
    const counters = counterRefs
        .map((counterRef) => counterRef?.counterId || counterRef)
        .filter(Boolean)
        .sort((a, b) => (a.number || 0) - (b.number || 0));

    return counters[0] || null;
};

const resolveDisplayCounter = (ticket, fallbackCounter = null) => {
    if (ticket.queueCounterId?.number) {
        return ticket.queueCounterId;
    }

    if (fallbackCounter?.number) {
        return fallbackCounter;
    }

    if (ticket.counterId?.number) {
        return ticket.counterId;
    }

    return null;
};

const buildTicketPresentation = (ticket, counter = null) => {
    const normalizedCounter = resolveDisplayCounter(ticket, counter);
    const formattedNumber = normalizedCounter?.number
        ? formatDisplayNumber(normalizedCounter.number, ticket.number)
        : formatQueueNumber(ticket.number);

    return {
        id: ticket._id,
        _id: ticket._id,
        number: ticket.number,
        ticketNumber: ticket.ticketNumber,
        formattedNumber,
        displayNumber: formattedNumber,
        customerName: ticket.name,
        phone: ticket.phone,
        status: ticket.status,
        serviceName: ticket.serviceId?.name,
        createdAt: ticket.createdAt
    };
};

const resolveIssueCounter = async (serviceId, requestedCounterId = null) => {
    const relations = await ServiceCounter.find({
        serviceId,
        isActive: true
    }).populate('counterId');

    if (relations.length === 0) {
        throw new ApiError(400, 'Dịch vụ này hiện chưa có quầy phục vụ.');
    }

    if (requestedCounterId) {
        const matchedRelation = relations.find((relation) => (
            String(relation.counterId?._id || relation.counterId) === String(requestedCounterId)
        ));

        if (!matchedRelation?.counterId?.isActive) {
            throw new ApiError(400, 'Quầy được chọn không phục vụ dịch vụ này hoặc đã bị khóa');
        }

        return {
            issueCounter: matchedRelation.counterId,
            availableCounters: relations
        };
    }

    return {
        issueCounter: getPrimaryCounter(relations),
        availableCounters: relations
    };
};

const getNextCounterNumber = async (counterId) => {
    const sequence = await CounterSequence.findOneAndUpdate(
        { counterId },
        { $inc: { lastNumber: 1 } },
        {
            returnDocument: 'after',
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return sequence.lastNumber;
};

const resetCounterSequences = async (counterIds = null) => {
    const query = counterIds?.length
        ? { counterId: { $in: counterIds } }
        : {};

    const result = await CounterSequence.updateMany(query, {
        $set: { lastNumber: 0 }
    });

    console.log(`Đã reset ${result.modifiedCount || 0} counter sequences về 0`);

    return result;
};

const emitStaffDisplayUpdateForCounters = async (counterIds, reason, extra = {}) => {
    if (!global.io || !counterIds?.length) {
        return;
    }

    const uniqueCounterIds = [...new Set(counterIds.map((counterId) => String(counterId)))];

    await Promise.all(
        uniqueCounterIds.map(async (counterId) => {
            try {
                global.io.to(`counter-${counterId}`).emit('staff-display-updated', {
                    reason,
                    counterId,
                    updatedAt: new Date().toISOString(),
                    data: await getStaffDisplay(counterId),
                    ...extra
                });

                const staffs = await User.find({
                    role: 'staff',
                    isActive: true,
                    counterId
                }).select('_id');

                await Promise.all(
                    staffs.map(async (staff) => {
                        const staffId = String(staff._id);

                        global.io.to(`staff-display-${staffId}`).emit('staff-display-updated', {
                            reason,
                            counterId,
                            staffId,
                            updatedAt: new Date().toISOString(),
                            data: await getStaffDisplay(counterId, staffId),
                            ...extra
                        });
                    })
                );
            } catch (error) {
                console.error(`Không thể cập nhật staff display cho quầy ${counterId}: ${error.message}`);
            }
        })
    );
};

const getCounterServiceIds = async (counterId) => {
    return ServiceCounter.find({
        counterId,
        isActive: true
    }).distinct('serviceId');
};

const getServiceAccessScope = async (counterId, staffId = null) => {
    return getStaffServiceAccess(staffId, counterId);
};

const ensureStaffHasAccessibleServices = (accessScope) => {
    if (accessScope.serviceRestrictionConfigured && accessScope.allowedServiceIds.length === 0) {
        throw new ApiError(403, 'Nhân viên chưa được gán dịch vụ nào tại quầy hiện tại');
    }
};

const canAccessService = (serviceIds, serviceId) => serviceIds.includes(String(serviceId));

const ensureCounterReadyForProcessing = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter?.isActive) {
        throw new ApiError(400, 'Quầy không tồn tại hoặc không hoạt động');
    }

    const currentTicket = await Ticket.findOne({
        counterId,
        status: TicketStatus.PROCESSING
    });

    if (currentTicket) {
        throw new ApiError(400, `Quầy đang xử lý ticket ${formatDisplayNumber(counter.number, currentTicket.number)}. Vui lòng hoàn thành hoặc bỏ qua trước khi gọi số mới.`);
    }

    return counter;
};

const emitTicketCalled = async (ticket, counter, reason = 'ticket-called') => {
    if (global.io) {
        const formattedNumber = buildTicketPresentation(ticket, counter).formattedNumber;

        global.io.to('waiting-room').emit('ticket-called', {
            ticket: {
                id: ticket._id,
                number: ticket.number,
                formattedNumber,
                customerName: ticket.name,
                serviceName: ticket.serviceId.name,
                isRecall: ticket.isRecall
            },
            counterName: counter.name,
            counterId: counter._id,
            calledAt: new Date(),
            reason
        });

        global.io.to(`counter-${counter._id}`).emit('new-current-ticket', {
            currentTicket: {
                id: ticket._id,
                number: ticket.number,
                formattedNumber,
                customerName: ticket.name,
                phone: ticket.phone,
                serviceName: ticket.serviceId.name,
                status: TicketStatus.PROCESSING
            }
        });
    }
};

const getRecallList = async (counterId, staffId = null) => {
    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    if (accessScope.allowedServiceIds.length === 0) {
        return [];
    }

    const recallTickets = await Ticket.find({
        recallCounterId: counterId,
        serviceId: { $in: accessScope.allowedServiceIds },
        status: TicketStatus.WAITING,
        isRecall: true
    })
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number')
        .sort({ recalledAt: 1, createdAt: 1, number: 1 });

    const now = Date.now();

    return recallTickets.map((ticket) => {
        const presentation = buildTicketPresentation(ticket);

        return {
        _id: ticket._id,
        number: ticket.number,
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber,
        customerName: ticket.name,
        phone: ticket.phone,
        serviceName: ticket.serviceId?.name,
        recalledAt: ticket.recalledAt,
        waitingMinutes: ticket.recalledAt
            ? Math.max(Math.floor((now - new Date(ticket.recalledAt).getTime()) / (1000 * 60)), 0)
            : 0
        };
    });
};

const createTicket = async ({ serviceId, name, phone, counterId = null }) => {
    const service = await Service.findById(serviceId);
    if (!service) throw new ApiError(404, 'Không tìm thấy dịch vụ');

    const { issueCounter, availableCounters } = await resolveIssueCounter(serviceId, counterId);
    const nextNumber = await getNextCounterNumber(issueCounter._id);
    const formattedNumber = formatQueueNumber(nextNumber);
    const displayNumber = formatDisplayNumber(issueCounter.number, nextNumber);

    const ticket = await Ticket.create({
        number: nextNumber,
        ticketNumber: formattedNumber,
        serviceId,
        queueCounterId: issueCounter._id,
        name,
        phone,
        status: TicketStatus.WAITING,
        isRecall: false,
        recalledAt: null,
        qrCode: null
    });

    await ticket.populate('serviceId', 'name code');
    const qrData = generateQRData(ticket, service, displayNumber);

    if (global.io) {
        const waitingCount = await Ticket.countDocuments({
            status: TicketStatus.WAITING,
            isRecall: false
        });
        const lastIssuedByCounter = await getLastIssuedByCounter();

        global.io.to('waiting-room').emit('new-ticket', {
            ticket: {
                id: ticket._id,
                number: ticket.number,
                formattedNumber: displayNumber,
                displayNumber,
                customerName: ticket.name,
                phone: ticket.phone,
                serviceName: service.name,
                status: ticket.status
            },
            totalWaiting: waitingCount,
            lastIssuedByCounter
        });

        console.log(`\x1b[36m Đã phát hành vé mới: ${displayNumber} - ${service.name}\x1b[0m`);
    }

    await emitStaffDisplayUpdateForCounters(
        extractCounterIdsFromRelations(availableCounters),
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
        issueCounter,
        ticketNumberDisplay: displayNumber,
        ticketNumberRaw: nextNumber,
        ticketNumberFormatted: displayNumber,
        availableCounters: availableCounters.map(ac => ac.counterId),
        qrData
    };
};

const getTicketByQR = async (qrData) => {
    const decoded = verifyQRData(qrData);

    return {
        ticketId: decoded.ticketId,
        displayNumber: decoded.displayNumber,
        serviceName: decoded.serviceName,
        serviceCode: decoded.serviceCode,
        customerName: decoded.customerName,
        customerPhone: decoded.customerPhone,
        issuedAt: decoded.issuedAt,
        exp: decoded.exp
    };
};

const getAllWaiting = async () => {
    const tickets = await Ticket.find({
        status: TicketStatus.WAITING,
        isRecall: false
    })
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number')
        .sort({ weight: -1, number: 1 });

    return tickets.map(ticket => ({
        ...ticket.toObject(),
        formattedNumber: buildTicketPresentation(ticket).formattedNumber,
        displayNumber: buildTicketPresentation(ticket).displayNumber
    }));
};

const getLastIssuedByCounter = async () => {
    const counters = await Counter.find({ isActive: true })
        .select('code name number isActive')
        .sort({ number: 1 })
        .lean();

    if (counters.length === 0) {
        return [];
    }

    const sequences = await CounterSequence.find({
        counterId: { $in: counters.map((counter) => counter._id) }
    })
        .select('counterId lastNumber')
        .lean();

    const sequenceMap = new Map(
        sequences.map((sequence) => [String(sequence.counterId), sequence.lastNumber || 0])
    );

    return counters.map((counter) => {
        const lastNumber = sequenceMap.get(String(counter._id)) || 0;

        return {
            counterId: counter._id,
            counterCode: counter.code,
            counterName: counter.name,
            counterNumber: counter.number,
            lastNumber,
            lastDisplayNumber: lastNumber > 0
                ? formatDisplayNumber(counter.number, lastNumber)
                : null
        };
    });
};

const getWaitingRoomData = async () => {
    const [tickets, lastIssuedByCounter] = await Promise.all([
        getAllWaiting(),
        getLastIssuedByCounter()
    ]);

    return {
        tickets,
        lastIssuedByCounter
    };
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

    await resetCounterSequences(affectedCounterIds);
    const lastIssuedByCounter = await getLastIssuedByCounter();

    if (global.io) {
        global.io.to('waiting-room').emit('tickets-reset-day', {
            date: formattedDate,
            deletedCount: ticketIds.length,
            lastIssuedByCounter
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
    await resetCounterSequences();
    const lastIssuedByCounter = await getLastIssuedByCounter();

    if (global.io) {
        global.io.to('waiting-room').emit('tickets-reset-all', {
            deletedCount,
            lastIssuedByCounter
        });

        global.io.emit('tickets-reset-all', {
            deletedCount,
            lastIssuedByCounter
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

const callNext = async (counterId, staffId = null) => {
    const counter = await ensureCounterReadyForProcessing(counterId);

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    if (accessScope.allowedServiceIds.length === 0) {
        throw new ApiError(400, 'Quầy chưa được gán dịch vụ');
    }

    const nextTicket = await Ticket.findOneAndUpdate(
        {
            queueCounterId: counterId,
            serviceId: { $in: accessScope.allowedServiceIds },
            status: TicketStatus.WAITING,
            counterId: null,
            isRecall: false
        },
        {
            status: TicketStatus.PROCESSING,
            counterId,
            processingAt: new Date(),
            recalledAt: null
        },
        { sort: { weight: -1, number: 1 }, returnDocument: 'after' }
    )
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number');

    if (!nextTicket) {
        throw new ApiError(404, 'Không có ticket đang chờ');
    }

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: nextTicket.serviceId._id,
        counterId,
        isActive: true
    });

    nextTicket.serviceCounterId = serviceCounter?._id || null;
    nextTicket.staffId = staffId || null;
    await nextTicket.save();
    counter.currentTicketId = nextTicket._id;
    await counter.save();

    await emitTicketCalled(nextTicket, counter, 'call-next');

    await emitStaffDisplayUpdateForCounters([counter._id], 'ticket-called', {
        ticketId: nextTicket._id
    });

    await emitDashboardUpdateSafe('ticket-called');

    return {
        nextTicket: {
            ...nextTicket.toObject(),
            formattedNumber: buildTicketPresentation(nextTicket, counter).formattedNumber,
            displayNumber: buildTicketPresentation(nextTicket, counter).displayNumber
        },
        counter
    };
};

const callById = async (ticketId, counterId, staffId = null) => {
    const counter = await ensureCounterReadyForProcessing(counterId);
    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number')
        .populate('counterId', 'name number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticket.status !== TicketStatus.WAITING) {
        throw new ApiError(400, 'Chỉ có thể gọi ticket đang ở trạng thái chờ');
    }

    if (!canAccessService(accessScope.allowedServiceIds, ticket.serviceId?._id || ticket.serviceId)) {
        throw new ApiError(403, 'Nhân viên không được phép gọi ticket thuộc dịch vụ này');
    }

    const belongsToCounter = ticket.isRecall
        ? String(ticket.recallCounterId || '') === String(counterId)
        : String(ticket.queueCounterId?._id || ticket.queueCounterId || '') === String(counterId);

    if (!belongsToCounter) {
        throw new ApiError(403, 'Ticket không thuộc danh sách xử lý của quầy này');
    }

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: ticket.serviceId._id,
        counterId,
        isActive: true
    });

    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.status = TicketStatus.PROCESSING;
    ticket.counterId = counterId;
    ticket.staffId = staffId || null;
    ticket.processingAt = new Date();
    ticket.serviceCounterId = serviceCounter?._id || null;
    await ticket.save();

    counter.currentTicketId = ticket._id;
    await counter.save();

    await emitTicketCalled(ticket, counter, 'call-by-id');

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-called', {
        ticketId: ticket._id,
        callMode: 'call-by-id'
    });

    await emitDashboardUpdateSafe('ticket-called');

    return {
        ticket: {
            ...ticket.toObject(),
            formattedNumber: buildTicketPresentation(ticket, counter).formattedNumber,
            displayNumber: buildTicketPresentation(ticket, counter).displayNumber
        },
        counter
    };
};

const recallTicket = async (ticketId, counterId, staffId = null) => {
    const counter = await ensureCounterReadyForProcessing(counterId);

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findOne({
        _id: ticketId,
        status: TicketStatus.WAITING,
        isRecall: true,
        recallCounterId: counterId,
        serviceId: { $in: accessScope.allowedServiceIds }
    })
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket trong danh sách cần gọi lại');
    }

    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.status = TicketStatus.PROCESSING;
    ticket.counterId = counterId;
    ticket.staffId = staffId || null;
    ticket.processingAt = new Date();

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: ticket.serviceId._id,
        counterId,
        isActive: true
    });

    ticket.serviceCounterId = serviceCounter?._id || null;
    await ticket.save();
    counter.currentTicketId = ticket._id;
    await counter.save();

    await emitTicketCalled(ticket, counter, 'recall-ticket');

    if (global.io) {
        const formattedNumber = buildTicketPresentation(ticket, counter).formattedNumber;
        global.io.to('waiting-room').emit('ticket-recalled', {
            ticketId: ticket._id,
            number: ticket.number,
            formattedNumber,
            customerName: ticket.name,
            counterId: counter._id,
            counterName: counter.name,
            serviceName: ticket.serviceId.name,
            recalledAt: new Date()
        });
    }

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-recalled', {
        ticketId: ticket._id
    });

    await emitDashboardUpdateSafe('ticket-recalled');

    return {
        ...ticket.toObject(),
        formattedNumber: buildTicketPresentation(ticket, counter).formattedNumber,
        displayNumber: buildTicketPresentation(ticket, counter).displayNumber
    };
};

const cancelRecallTicket = async (ticketId, counterId, staffId = null, reason = '') => {
    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findOne({
        _id: ticketId,
        status: TicketStatus.WAITING,
        isRecall: true,
        recallCounterId: counterId,
        serviceId: { $in: accessScope.allowedServiceIds }
    })
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket trong danh sách cần gọi lại');
    }

    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.status = TicketStatus.SKIPPED;
    ticket.counterId = null;
    ticket.staffId = null;
    ticket.serviceCounterId = null;
    ticket.processingAt = null;

    if (reason) {
        ticket.note = reason;
    }

    await ticket.save();

    if (global.io) {
        const presentation = buildTicketPresentation(ticket);

        global.io.to('waiting-room').emit('ticket-recall-cancelled', {
            ticketId: ticket._id,
            number: ticket.number,
            formattedNumber: presentation.formattedNumber,
            displayNumber: presentation.displayNumber,
            customerName: ticket.name,
            serviceName: ticket.serviceId?.name,
            cancelledAt: new Date()
        });
    }

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-recall-cancelled', {
        ticketId: ticket._id
    });

    await emitDashboardUpdateSafe('ticket-recall-cancelled');

    const presentation = buildTicketPresentation(ticket);

    return {
        ...ticket.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

const completeTicket = async (id, counterId = null, staffId = null) => {
    const ticket = await Ticket.findById(id)
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number');
    if (!ticket) throw new ApiError(404, 'Không tìm thấy ticket');
    if (ticket.status !== TicketStatus.PROCESSING) throw new ApiError(400, 'Ticket không ở trạng thái đang xử lý');

    if (counterId && String(ticket.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép hoàn thành ticket của quầy được gán');
    }

    if (staffId && counterId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId?._id || ticket.serviceId);
    }

    ticket.status = TicketStatus.COMPLETED;
    ticket.completedAt = new Date();
    ticket.qrCode = null;
    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.staffId = null;
    await ticket.save();

    if (global.io) {
        const formattedNumberComplete = buildTicketPresentation(ticket).formattedNumber;
        
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
        formattedNumber: buildTicketPresentation(ticket).formattedNumber,
        displayNumber: buildTicketPresentation(ticket).displayNumber
    };
};

const skipTicket = async (id, reason = '', counterId, staffId = null) => {
    const ticket = await Ticket.findById(id)
        .populate('serviceId', 'name code')
        .populate('queueCounterId', 'number');
    if (!ticket) throw new ApiError(404, 'Không tìm thấy ticket');
    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, 'Chỉ có thể bỏ qua ticket đang xử lý');
    }

    const currentCounterId = counterId || ticket.counterId;

    if (counterId && String(ticket.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép bỏ qua ticket của quầy được gán');
    }

    if (staffId && currentCounterId) {
        await assertStaffCanHandleService(staffId, currentCounterId, ticket.serviceId?._id || ticket.serviceId);
    }

    ticket.skipCount = (ticket.skipCount || 0) + 1;
    ticket.weight = 0;
    ticket.isRecall = true;
    ticket.recalledAt = new Date();
    ticket.recallCounterId = currentCounterId;
    ticket.status = TicketStatus.WAITING;
    ticket.counterId = null;
    ticket.staffId = null;
    ticket.serviceCounterId = null;
    ticket.processingAt = null;
    
    if (reason) {
        ticket.note = reason;
    }
    await ticket.save();

    if (currentCounterId) {
        await Counter.findByIdAndUpdate(currentCounterId, { currentTicketId: null });
    }

    if (global.io) {
        const formattedNumberSkip = buildTicketPresentation(ticket).formattedNumber;

        global.io.to('waiting-room').emit('ticket-skipped', {
            ticketId: ticket._id,
            number: ticket.number,
            formattedNumber: formattedNumberSkip,
            customerName: ticket.name,
            skipCount: ticket.skipCount,
            weight: ticket.weight,
            isRecall: true,
            recalledAt: ticket.recalledAt
        });
        
        if (currentCounterId) {
            global.io.to(`counter-${currentCounterId}`).emit('ticket-skipped', {
                ticketId: ticket._id,
                formattedNumber: formattedNumberSkip
            });
        }
    }

    await emitStaffDisplayUpdateForCounters(
        currentCounterId ? [currentCounterId] : [],
        'ticket-skipped',
        {
            ticketId: ticket._id
        }
    );

    await emitDashboardUpdateSafe('ticket-skipped');

    return {
        ...ticket.toObject(),
        formattedNumber: buildTicketPresentation(ticket).formattedNumber,
        displayNumber: buildTicketPresentation(ticket).displayNumber
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
        queueCounterId: counterId,
        serviceId: { $in: serviceIds },
        status: TicketStatus.WAITING,
        isRecall: false
    })
    .populate('serviceId', 'name code')
    .populate('queueCounterId', 'number')
    .sort({ weight: -1, createdAt: 1, number: 1 })
    .limit(10);

    let currentTicket = null;
    if (counter.currentTicketId) {
        currentTicket = await Ticket.findById(counter.currentTicketId)
            .populate('serviceId', 'name code')
            .populate('queueCounterId', 'number');
    }

    const formatTicket = (ticket) => buildTicketPresentation(ticket, counter);

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
        recallTickets: [],
        totalWaiting: waitingTickets.length
    };
};

const getMyCounter = async (counterId, staffId = null) => {
    const counter = await Counter.findById(counterId);
    if (!counter) {
        throw new ApiError(404, 'Không tìm thấy quầy của bạn');
    }

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    let currentTicket = null;
    if (counter.currentTicketId) {
        currentTicket = await Ticket.findById(counter.currentTicketId)
            .populate('serviceId', 'name code')
            .populate('queueCounterId', 'number');
    }

    if (currentTicket && !canAccessService(accessScope.allowedServiceIds, currentTicket.serviceId?._id || currentTicket.serviceId)) {
        currentTicket = null;
    }

    return {
        counter: {
            id: counter._id,
            name: counter.name,
            number: counter.number,
            processedCount: counter.processedCount,
            isActive: counter.isActive
        },
        services: accessScope.allowedServices,
        availableServices: accessScope.availableServices,
        assignedServices: accessScope.assignedServices,
        serviceRestrictionConfigured: accessScope.serviceRestrictionConfigured,
        currentTicket: currentTicket
            ? buildTicketPresentation(currentTicket, counter)
            : null
    };
};

const getStaffDisplay = async (counterId, staffId = null) => {
    const counter = await Counter.findById(counterId);
    if (!counter) throw new ApiError(404, 'Không tìm thấy quầy');

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const waitingTickets = await Ticket.find({
        queueCounterId: counterId,
        serviceId: { $in: accessScope.allowedServiceIds },
        status: TicketStatus.WAITING,
        isRecall: false
    })
    .populate('serviceId', 'name code')
    .populate('queueCounterId', 'number')
    .sort({ weight: -1, createdAt: 1, number: 1 })
    .limit(10);

    let currentTicket = null;
    if (counter.currentTicketId) {
        currentTicket = await Ticket.findById(counter.currentTicketId)
            .populate('serviceId', 'name code')
            .populate('queueCounterId', 'number');
    }

    if (currentTicket && !canAccessService(accessScope.allowedServiceIds, currentTicket.serviceId?._id || currentTicket.serviceId)) {
        currentTicket = null;
    }

    const formatTicket = (ticket) => buildTicketPresentation(ticket, counter);

    return {
        counter: {
            id: counter._id,
            name: counter.name,
            number: counter.number,
            isActive: counter.isActive,
            processedCount: counter.processedCount
        },
        services: accessScope.allowedServices,
        availableServices: accessScope.availableServices,
        assignedServices: accessScope.assignedServices,
        serviceRestrictionConfigured: accessScope.serviceRestrictionConfigured,
        currentTicket: currentTicket ? formatTicket(currentTicket) : null,
        waitingTickets: waitingTickets.map(formatTicket),
        recallTickets: await getRecallList(counterId, staffId),
        totalWaiting: waitingTickets.length
    };
};

module.exports = {
    createTicket,
    getAllWaiting,
    getLastIssuedByCounter,
    getWaitingRoomData,
    getRecallList,
    resetTicketsByDate,
    resetAllTickets,
    callNext,
    callById,
    recallTicket,
    cancelRecallTicket,
    completeTicket,
    skipTicket,
    getCounterDisplay,
    getMyCounter,
    getStaffDisplay,
    getTicketByQR,
};
