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
    const ticketNumber = `${service.code}${formattedNumber}`;

    const ticket = await Ticket.create({
        number: nextNumber,
        ticketNumber,
        serviceId,
        name,
        phone,
        status: TicketStatus.WAITING
    });

    await ticket.populate('serviceId', 'name code');

    return {
        ticket,
        service,
        ticketNumberDisplay: ticketNumber,
        ticketNumberRaw: nextNumber,
        ticketNumberFormatted: formattedNumber,
        availableCounters: availableCounters.map(ac => ac.counterId)
    };
};

// GET WAITING
const getWaitingByService = async (serviceId) => {
    const service = await Service.findById(serviceId);
    if (!service) throw new ApiError(404, 'Không tìm thấy dịch vụ');

    const tickets = await Ticket.find({ serviceId, status: TicketStatus.WAITING })
        .populate('serviceId', 'name code')
        .sort({ number: 1 });

    return tickets.map(ticket => ({
        ...ticket.toObject(),
        displayText: `${ticket.serviceId?.name} - ${ticket.number.toString().padStart(3, '0')}`,
        formattedNumber: ticket.number.toString().padStart(3, '0')
    }));
};

// CALL NEXT
const callNext = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter || !counter.isActive) throw new ApiError(400, 'Quầy không tồn tại hoặc không hoạt động');

    const serviceRelations = await ServiceCounter.find({ counterId, isActive: true }).select('serviceId');
    const serviceIds = serviceRelations.map(rel => rel.serviceId);
    if (serviceIds.length === 0) throw new ApiError(400, 'Quầy này chưa được gán dịch vụ nào');

    const nextTicket = await Ticket.findOneAndUpdate(
        { serviceId: { $in: serviceIds }, status: TicketStatus.WAITING, counterId: null },
        { status: TicketStatus.PROCESSING, counterId, processingAt: new Date() },
        { sort: { number: 1 }, new: true }
    ).populate('serviceId', 'name code');

    if (!nextTicket) throw new ApiError(404, 'Không có ticket đang chờ cho các dịch vụ của quầy');

    const serviceCounter = await ServiceCounter.findOne({ serviceId: nextTicket.serviceId._id, counterId });
    if (serviceCounter) {
        nextTicket.serviceCounterId = serviceCounter._id;
        await nextTicket.save();
    }

    counter.currentTicketId = nextTicket._id;
    await counter.save();

    return {
        nextTicket: {
            ...nextTicket.toObject(),
            displayText: `${nextTicket.serviceId?.name} - ${nextTicket.number.toString().padStart(3, '0')}`,
            formattedNumber: nextTicket.number.toString().padStart(3, '0')
        },
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
        displayText: `${ticket.serviceId?.name} - ${ticket.number.toString().padStart(3, '0')}`,
        formattedNumber: ticket.number.toString().padStart(3, '0')
    };
};

// CURRENT TICKET
const getCurrentTicket = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter) throw new ApiError(404, 'Không tìm thấy quầy');
    if (!counter.currentTicketId) return null;

    const ticket = await Ticket.findById(counter.currentTicketId).populate('serviceId', 'name code');
    if (!ticket) return null;

    return {
        ...ticket.toObject(),
        displayText: `${ticket.serviceId?.name} - ${ticket.number.toString().padStart(3, '0')}`,
        formattedNumber: ticket.number.toString().padStart(3, '0')
    };
};

// GET ALL WAITING
const getAllWaiting = async () => {
    const tickets = await Ticket.find({ status: TicketStatus.WAITING })
        .populate('serviceId', 'name code')
        .sort({ number: 1 });

    return tickets.map(ticket => ({
        ...ticket.toObject(),
        displayText: `${ticket.serviceId?.name} - ${ticket.number.toString().padStart(3, '0')}`,
        formattedNumber: ticket.number.toString().padStart(3, '0')
    }));
};

module.exports = {
    createTicket,
    getWaitingByService,
    getAllWaiting,
    callNext,
    completeTicket,
    getCurrentTicket
};