const Ticket = require('../../models/ticket.model');
const Counter = require('../../models/counter.model');
const ServiceCounter = require('../../models/serviceCounter.model');
const CounterSequence = require('../../models/counterSequence.model');
const { TicketStatus } = require('../../constants/enums');
const ApiError = require('../../utils/ApiError');
const { verifyQRData } = require('../../utils/qrData.util');
const { getStaffServiceAccess } = require('../staff-permission.service');
const {
    buildTicketPresentation,
    formatCounterDisplayNumber
} = require('./ticket.helpers');

const getServiceAccessScope = async (counterId, staffId = null) => {
    return getStaffServiceAccess(staffId, counterId);
};

const ensureStaffHasAccessibleServices = (accessScope) => {
    if (accessScope.serviceRestrictionConfigured && accessScope.allowedServiceIds.length === 0) {
        throw new ApiError(403, 'Nhân viên chưa được gán dịch vụ nào tại quầy hiện tại');
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
        .populate('serviceId', 'name code prefixNumber')
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
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .sort({ createdAt: 1, number: 1 });

    return tickets.map((ticket) => {
        const presentation = buildTicketPresentation(ticket);

        return {
            ...ticket.toObject(),
            formattedNumber: presentation.formattedNumber,
            displayNumber: presentation.displayNumber
        };
    });
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
                ? formatCounterDisplayNumber(counter.number, lastNumber)
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

const getCounterDisplay = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter) {
        throw new ApiError(404, 'Không tìm thấy quầy');
    }

    const serviceRelations = await ServiceCounter.find({
        counterId,
        isActive: true
    }).populate('serviceId', 'name code prefixNumber isActive');

    // [SỬA lỗi 3] Lọc bỏ dịch vụ đã bị tắt
    const activeServiceRelations = serviceRelations.filter(r => r.serviceId?.isActive === true);
    const serviceIds = activeServiceRelations.map((relation) => relation.serviceId._id);

    const waitingTickets = await Ticket.find({
        queueCounterId: counterId,
        serviceId: { $in: serviceIds },
        status: TicketStatus.WAITING,
        isRecall: false
    })
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .sort({ createdAt: 1, number: 1 })
        .limit(10);

    const processingTickets = await Ticket.find({
        counterId,
        status: TicketStatus.PROCESSING
    })
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .sort({ processingAt: 1, createdAt: 1, number: 1 });

    const formatTicket = (ticket) => buildTicketPresentation(ticket, counter);

    return {
        counter: {
            id: counter._id,
            name: counter.name,
            number: counter.number,
            isActive: counter.isActive,
            processedCount: counter.processedCount
        },
        services: serviceRelations.map((relation) => ({
            id: relation.serviceId._id,
            name: relation.serviceId.name,
            code: relation.serviceId.code
        })),
        currentTicket: processingTickets.length ? formatTicket(processingTickets[0]) : null,
        processingTickets: processingTickets.map(formatTicket),
        waitingTickets: waitingTickets.map(formatTicket),
        recallTickets: [],
        totalWaiting: waitingTickets.length
    };
};

const getCurrentTicketForStaff = async (counterId, staffId, allowedServiceIds) => {
    if (!counterId || !allowedServiceIds?.length) {
        return null;
    }

    const query = {
        counterId,
        status: TicketStatus.PROCESSING,
        serviceId: { $in: allowedServiceIds }
    };

    if (staffId) {
        query.staffId = staffId;
    }

    return Ticket.findOne(query)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .sort({ processingAt: -1, updatedAt: -1 });
};

const getMyCounter = async (counterId, staffId = null) => {
    const counter = await Counter.findById(counterId);
    if (!counter) {
        throw new ApiError(404, 'Không tìm thấy quầy của bạn');
    }

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const currentTicket = await getCurrentTicketForStaff(
        counterId,
        staffId,
        accessScope.allowedServiceIds
    );

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
    if (!counter) {
        throw new ApiError(404, 'Không tìm thấy quầy');
    }

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const waitingTickets = await Ticket.find({
        queueCounterId: counterId,
        serviceId: { $in: accessScope.allowedServiceIds },
        status: TicketStatus.WAITING,
        isRecall: false
    })
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .sort({ createdAt: 1, number: 1 });

    const currentTicket = await Ticket.findOne({
        counterId,
        ...(staffId ? { staffId } : {}),
        status: TicketStatus.PROCESSING,
        serviceId: { $in: accessScope.allowedServiceIds }
    })
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .sort({ processingAt: -1, updatedAt: -1 });

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
    getAllWaiting,
    getCounterDisplay,
    getCurrentTicketForStaff,
    getLastIssuedByCounter,
    getMyCounter,
    getRecallList,
    getStaffDisplay,
    getTicketByQR,
    getWaitingRoomData
};