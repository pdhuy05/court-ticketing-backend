const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const Counter = require('../models/counter.model');
const ServiceCounter = require('../models/serviceCounter.model');
const { TicketStatus } = require('../constants/enums');
const ApiError = require('../utils/ApiError');

// CREATE
const createTicket = async ({ serviceId, name, phone }) => {
    const service = await Service.findById(serviceId);
    if (!service) throw new ApiError(404, 'Không tìm thấy dịch vụ');

    const availableCounters = await ServiceCounter.find({ serviceId, isActive: true }).populate('counterId');
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
        status: TicketStatus.WAITING
    });

    await ticket.populate('serviceId', 'name code');

    return {
        ticket,
        service,
        ticketNumberDisplay: formattedNumber,
        ticketNumberRaw: nextNumber,
        ticketNumberFormatted: formattedNumber,
        availableCounters: availableCounters.map(ac => ac.counterId)
    };
};

// GET ALL WAITING
const getAllWaiting = async () => {
    const tickets = await Ticket.find({ status: TicketStatus.WAITING })
        .populate('serviceId', 'name code')
        .sort({ number: 1 });

    return tickets.map(ticket => ({
        ...ticket.toObject(),
        formattedNumber: ticket.number.toString().padStart(3, '0')
    }));
};

// CALL NEXT
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
        { serviceId: { $in: serviceIds }, status: TicketStatus.WAITING, counterId: null },
        { status: TicketStatus.PROCESSING, counterId, processingAt: new Date() },
        { sort: { number: 1 }, returnDocument: 'after' }
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

    const formatTicket = (ticket) => ({
        ...ticket.toObject(),
        formattedNumber: String(ticket.number).padStart(3, '0')
    });

    return {
        nextTicket: formatTicket(nextTicket),
        counter
    };
};

// COMPLETE
const completeTicket = async (id) => {
    const ticket = await Ticket.findById(id).populate('serviceId', 'name code');
    if (!ticket) throw new ApiError(404, 'Không tìm thấy ticket');
    if (ticket.status !== TicketStatus.PROCESSING) throw new ApiError(400, 'Ticket không ở trạng thái đang xử lý');

    ticket.status = TicketStatus.COMPLETED;
    ticket.completedAt = new Date();
    await ticket.save();

    if (ticket.counterId) {
        await Counter.findByIdAndUpdate(ticket.counterId, {
            currentTicketId: null,
            $inc: { processedCount: 1 }
        });
    }

    return {
        ...ticket.toObject(),
        formattedNumber: ticket.number.toString().padStart(3, '0')
    };
};

// SKIP TICKET
const skipTicket = async (id, reason = '') => {
    const ticket = await Ticket.findById(id).populate('serviceId', 'name code');
    if (!ticket) throw new ApiError(404, 'Không tìm thấy ticket');
    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, 'Chỉ có thể bỏ qua ticket đang xử lý');
    }

    ticket.status = TicketStatus.SKIPPED;
    ticket.note = reason;
    await ticket.save();

    if (ticket.counterId) {
        await Counter.findByIdAndUpdate(ticket.counterId, {
            currentTicketId: null
        });
    }

    return {
        ...ticket.toObject(),
        formattedNumber: ticket.number.toString().padStart(3, '0')
    };
};

// GET COUNTER DISPLAY
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
    .sort({ number: 1 })
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

module.exports = {
    createTicket,
    getAllWaiting,
    callNext,
    completeTicket,
    skipTicket,
    getCounterDisplay,
};