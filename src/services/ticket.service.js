const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const Counter = require('../models/counter.model');
const { TicketStatus } = require('../constants/enums');
const ApiError = require('../utils/ApiError');

// CREATE
const createTicket = async ({ serviceId, name, gender, phone }) => {
    const service = await Service.findById(serviceId);
    if (!service) {
        throw new ApiError(404, 'Không tìm thấy dịch vụ');
    }

    const lastTicket = await Ticket.findOne({
        serviceId: service._id
    }).sort({ createdAt: -1 });

    let sequence = 1;
    if (lastTicket) {
        const lastNumber = parseInt(lastTicket.ticketNumber.slice(-3));
        sequence = lastNumber + 1;
    }

    const ticketNumber = `${service.code}${String(sequence).padStart(3, '0')}`;

    const ticket = await Ticket.create({
        ticketNumber,
        serviceId: service._id,
        name,
        gender,
        phone,
        status: TicketStatus.WAITING
    });

    return { ticket, service };
};

// GET WAITING
const getWaitingByService = async (serviceId) => {
    const service = await Service.findById(serviceId);
    if (!service) {
        throw new ApiError(404, 'Không tìm thấy dịch vụ');
    }

    return await Ticket.find({
        serviceId: service._id,
        status: TicketStatus.WAITING
    }).sort({ createdAt: 1 });
};

// CALL NEXT
const callNext = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter || !counter.isActive) {
        throw new ApiError(400, 'Quầy không tồn tại hoặc không hoạt động');
    }

    const nextTicket = await Ticket.findOneAndUpdate(
        {
            serviceId: counter.serviceId,
            status: TicketStatus.WAITING,
            counterId: null
        },
        {
            status: TicketStatus.PROCESSING,
            counterId: counter._id,
            processingAt: new Date()
        },
        { sort: { createdAt: 1 }, new: true }
    );

    if (!nextTicket) {
        throw new ApiError(404, 'Không có ticket đang chờ');
    }

    counter.currentTicketId = nextTicket._id;
    await counter.save();

    return { nextTicket, counter };
};

// COMPLETE
const completeTicket = async (id) => {
    const ticket = await Ticket.findByIdAndUpdate(
        id,
        {
            status: TicketStatus.COMPLETED,
            completedAt: new Date()
        },
        { new: true }
    );

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticket.counterId) {
        await Counter.findByIdAndUpdate(ticket.counterId, {
            currentTicketId: null,
            $inc: { processedCount: 1 }
        });
    }

    return ticket;
};

// CURRENT
const getCurrentTicket = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter) {
        throw new ApiError(404, 'Không tìm thấy quầy');
    }

    if (!counter.currentTicketId) return null;

    return await Ticket.findById(counter.currentTicketId);
};

module.exports = {
    createTicket,
    getWaitingByService,
    callNext,
    completeTicket,
    getCurrentTicket
};