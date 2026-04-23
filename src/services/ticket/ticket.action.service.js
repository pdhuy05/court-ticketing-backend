const Ticket = require('../../models/ticket.model');
const Service = require('../../models/service.model');
const Counter = require('../../models/counter.model');
const ServiceCounter = require('../../models/serviceCounter.model');
const CounterSequence = require('../../models/counterSequence.model');
const { TicketStatus } = require('../../constants/enums');
const ApiError = require('../../utils/ApiError');
const { emitDashboardUpdateSafe } = require('../dashboard.service');
const { generateQRData } = require('../../utils/qrData.util');
const { getStaffServiceAccess, assertStaffCanHandleService } = require('../staff-permission.service');
const {
    buildTicketPresentation,
    extractCounterIdsFromRelations,
    formatQueueNumber,
    formatServiceDisplayNumber,
    getDurationInSeconds,
    getPrimaryCounter
} = require('./ticket.helpers');
const { getLastIssuedByCounter } = require('./ticket.query.service');
const {
    emitStaffDisplayUpdateForCounters,
    emitTicketBackToWaiting,
    emitTicketCalled,
    emitTicketCompleted,
    emitTicketProcessingRecalled,
    emitTicketRecallCancelled,
    emitTicketRecalled,
    emitTicketSkipped,
    emitWaitingRoomNewTicket
} = require('./ticket.socket');

const MAX_RECALL_SKIP_COUNT = 2;

const getServiceAccessScope = async (counterId, staffId = null) => {
    return getStaffServiceAccess(staffId, counterId);
};

const ensureStaffHasAccessibleServices = (accessScope) => {
    if (accessScope.serviceRestrictionConfigured && accessScope.allowedServiceIds.length === 0) {
        throw new ApiError(403, 'Nhân viên chưa được gán dịch vụ nào tại quầy hiện tại');
    }
};

const canAccessService = (serviceIds, serviceId) => serviceIds.includes(String(serviceId));


const markTicketAsCalled = (ticket, calledTime = new Date()) => {
    if (!ticket.calledAt) {
        ticket.calledAt = calledTime;
        ticket.waitingDuration = getDurationInSeconds(ticket.createdAt, calledTime);
    }

    ticket.processingAt = calledTime;
    ticket.skippedAt = null;
};

const ensureCounterActive = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter?.isActive) {
        throw new ApiError(400, 'Quầy không tồn tại hoặc không hoạt động');
    }

    return counter;
};

const resolveIssueCounter = async (serviceId, requestedCounterId = null) => {
  const relations = await ServiceCounter.find({
    serviceId,
    isActive: true
  }).populate('counterId');

  const activeRelations = relations.filter(r => r.counterId?.isActive === true);

  if (activeRelations.length === 0) {
    throw new ApiError(400, 'Dịch vụ này hiện chưa có quầy phục vụ.');
  }

  if (requestedCounterId) {
    const matchedRelation = activeRelations.find((relation) => (
      String(relation.counterId?._id || relation.counterId) === String(requestedCounterId)
    ));

    if (!matchedRelation?.counterId?.isActive) {
      throw new ApiError(400, 'Quầy được chọn không phục vụ dịch vụ này hoặc đã bị khóa');
    }

    return {
      issueCounter: matchedRelation.counterId,
      availableCounters: activeRelations  
    };
  }

  return {
    issueCounter: getPrimaryCounter(activeRelations),  
    availableCounters: activeRelations               
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

const refreshCounterCurrentTicket = async (counterId) => {
    if (!counterId) {
        return;
    }

    const latestProcessingTicket = await Ticket.findOne({
        counterId,
        status: TicketStatus.PROCESSING
    }).sort({ processingAt: -1, updatedAt: -1 });

    await Counter.findByIdAndUpdate(counterId, {
        currentTicketId: latestProcessingTicket?._id || null
    });
};

const createTicket = async ({ serviceId, name, phone, counterId = null }) => {
    const service = await Service.findById(serviceId);
    if (!service) {
        throw new ApiError(404, 'Không tìm thấy dịch vụ');
    }

    if (!service.isActive) {
        throw new ApiError(400, `Dịch vụ ${service.name} đã bị vô hiệu hóa, không thể lấy số`);
    }

    const { issueCounter, availableCounters } = await resolveIssueCounter(serviceId, counterId);
    const nextNumber = await getNextCounterNumber(issueCounter._id);
    const formattedNumber = formatQueueNumber(nextNumber);
    const servicePrefix = typeof service.prefixNumber === 'number' ? service.prefixNumber : 0;
    const displayNumber = formatServiceDisplayNumber(servicePrefix, nextNumber);

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
        qrData: null,
        displayUsesServicePrefix: true
    });

    await ticket.populate('serviceId', 'name code prefixNumber');
    const qrData = generateQRData(ticket, service, displayNumber);
    ticket.qrData = qrData;
    await ticket.save();

    const waitingCount = await Ticket.countDocuments({
        status: TicketStatus.WAITING,
        isRecall: false
    });
    const lastIssuedByCounter = await getLastIssuedByCounter();

    emitWaitingRoomNewTicket({
        ticket,
        service,
        displayNumber,
        totalWaiting: waitingCount,
        lastIssuedByCounter
    });

    console.log(`\x1b[36m Đã phát hành vé mới: ${displayNumber} - ${service.name}\x1b[0m`);

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
        availableCounters: availableCounters.map((availableCounter) => availableCounter.counterId),
        qrData
    };
};

const callNext = async (counterId, staffId = null) => {
    const counter = await ensureCounterActive(counterId);

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    if (accessScope.allowedServiceIds.length === 0) {
        throw new ApiError(400, 'Quầy chưa được gán dịch vụ');
    }

    let nextTicket = null;

    while (!nextTicket) {
        const candidateTicket = await Ticket.findOne({
            queueCounterId: counterId,
            serviceId: { $in: accessScope.allowedServiceIds },
            status: TicketStatus.WAITING,
            counterId: null,
            isRecall: false
        })
            .sort({ createdAt: 1, number: 1 })
            .populate('serviceId', 'name code prefixNumber')
            .populate('queueCounterId', 'number');

        if (!candidateTicket) {
            throw new ApiError(404, 'Không có ticket đang chờ trong danh sách dịch vụ được phân quyền');
        }

        if (staffId) {
            await assertStaffCanHandleService(staffId, counterId, candidateTicket.serviceId._id);
        }

        nextTicket = await Ticket.findOneAndUpdate(
            {
                _id: candidateTicket._id,
                status: TicketStatus.WAITING,
                counterId: null,
                isRecall: false
            },
            {
                status: TicketStatus.PROCESSING,
                counterId,
                recalledAt: null
            },
            { returnDocument: 'after' }
        )
            .populate('serviceId', 'name code prefixNumber')
            .populate('queueCounterId', 'number');
    }

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: nextTicket.serviceId._id,
        counterId,
        isActive: true
    });

    nextTicket.serviceCounterId = serviceCounter?._id || null;
    nextTicket.staffId = staffId || null;
    markTicketAsCalled(nextTicket);
    await nextTicket.save();

    counter.currentTicketId = nextTicket._id;
    await counter.save();

    await emitTicketCalled(nextTicket, counter, 'call-next');

    await emitStaffDisplayUpdateForCounters([counter._id], 'ticket-called', {
        ticketId: nextTicket._id
    });

    await emitDashboardUpdateSafe('ticket-called');

    const presentation = buildTicketPresentation(nextTicket, counter);

    return {
        nextTicket: {
            ...nextTicket.toObject(),
            formattedNumber: presentation.formattedNumber,
            displayNumber: presentation.displayNumber
        },
        counter
    };
};

const callById = async (ticketId, counterId, staffId = null) => {
    const counter = await ensureCounterActive(counterId);
    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .populate('counterId', 'name number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticket.status !== TicketStatus.WAITING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể gọi. Chỉ có thể gọi ticket đang chờ`);
    }

    if (!canAccessService(accessScope.allowedServiceIds, ticket.serviceId?._id || ticket.serviceId)) {
        const serviceName = ticket.serviceId?.name || 'không xác định';
        throw new ApiError(403, `Bạn không có quyền xử lý dịch vụ ${serviceName}`);
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId._id);
    }

    const belongsToCounter = ticket.isRecall
        ? String(ticket.recallCounterId || '') === String(counterId)
        : String(ticket.queueCounterId?._id || ticket.queueCounterId || '') === String(counterId);

    if (!belongsToCounter) {
        throw new ApiError(403, `Ticket không thuộc danh sách xử lý của quầy ${counter.name}`);
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
    markTicketAsCalled(ticket);
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

    const presentation = buildTicketPresentation(ticket, counter);

    return {
        ticket: {
            ...ticket.toObject(),
            formattedNumber: presentation.formattedNumber,
            displayNumber: presentation.displayNumber
        },
        counter
    };
};

const recallTicket = async (ticketId, counterId, staffId = null) => {
    const counter = await ensureCounterActive(counterId);

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Ticket không tồn tại');
    }

    if (ticket.status !== TicketStatus.WAITING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể gọi lại. Chỉ gọi lại được ticket đang chờ`);
    }

    if (!ticket.isRecall || String(ticket.recallCounterId) !== String(counterId)) {
        throw new ApiError(400, `Ticket không nằm trong danh sách gọi lại của quầy ${counter.name}`);
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId?._id || ticket.serviceId);
    }

    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.status = TicketStatus.PROCESSING;
    ticket.counterId = counterId;
    ticket.staffId = staffId || null;
    markTicketAsCalled(ticket);

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
    emitTicketRecalled(ticket, counter);

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-recalled', {
        ticketId: ticket._id
    });

    await emitDashboardUpdateSafe('ticket-recalled');

    const presentation = buildTicketPresentation(ticket, counter);

    return {
        ...ticket.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

const recallProcessingTicket = async (ticketId, counterId, staffId = null) => {
    const counter = await ensureCounterActive(counterId);
    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Ticket không tồn tại');
    }

    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể gọi lại. Chỉ gọi lại được ticket đang xử lý`);
    }

    if (String(ticket.counterId) !== String(counterId)) {
        throw new ApiError(403, `Ticket không thuộc quầy ${counter.name}`);
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId?._id || ticket.serviceId);
    }

    if (staffId && ticket.staffId && String(ticket.staffId) !== String(staffId)) {
        throw new ApiError(403, 'Bạn chỉ được phép gọi lại ticket đang xử lý của chính mình');
    }

    await emitTicketCalled(ticket, counter, 'recall-processing');
    emitTicketProcessingRecalled(ticket, counter);

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-processing-recalled', {
        ticketId: ticket._id
    });

    await emitDashboardUpdateSafe('ticket-processing-recalled');

    const presentation = buildTicketPresentation(ticket, counter);

    return {
        ...ticket.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

const cancelRecallTicket = async (ticketId, counterId, staffId = null, reason = '') => {
    await ensureCounterActive(counterId);

    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Ticket không tồn tại');
    }

    if (ticket.status !== TicketStatus.WAITING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể hủy gọi lại. Chỉ hủy được ticket đang chờ`);
    }

    if (!ticket.isRecall || String(ticket.recallCounterId) !== String(counterId)) {
        throw new ApiError(400, 'Ticket không nằm trong danh sách gọi lại của quầy hiện tại');
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId?._id || ticket.serviceId);
    }

    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.status = TicketStatus.SKIPPED;
    ticket.counterId = null;
    ticket.staffId = null;
    ticket.serviceCounterId = null;
    ticket.processingAt = null;
    ticket.skippedAt = new Date();

    if (reason) {
        ticket.note = reason;
    }

    await ticket.save();

    emitTicketRecallCancelled(ticket);

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
    if (counterId) await ensureCounterActive(counterId);

    const ticket = await Ticket.findById(id)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể hoàn thành. Chỉ hoàn thành được ticket đang xử lý`);
    }

    if (counterId && String(ticket.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép hoàn thành ticket của quầy được gán');
    }

    if (staffId && counterId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId?._id || ticket.serviceId);
    }

    ticket.status = TicketStatus.COMPLETED;
    ticket.completedAt = new Date();
    ticket.qrData = null;
    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.staffId = null;
    ticket.processingDuration = getDurationInSeconds(
        ticket.calledAt || ticket.processingAt || ticket.createdAt,
        ticket.completedAt
    );
    ticket.totalDuration = getDurationInSeconds(ticket.createdAt, ticket.completedAt);
    await ticket.save();

    emitTicketCompleted(ticket);
    console.log(`\x1b[32m Vé đã được phát hành - hoàn tất: ${buildTicketPresentation(ticket).formattedNumber}\x1b[0m`);

    if (ticket.counterId) {
        await Counter.findByIdAndUpdate(ticket.counterId, {
            $inc: { processedCount: 1 }
        });
        await refreshCounterCurrentTicket(ticket.counterId);

        await emitStaffDisplayUpdateForCounters([ticket.counterId], 'ticket-completed', {
            ticketId: ticket._id
        });
    }

    await emitDashboardUpdateSafe('ticket-completed');

    const presentation = buildTicketPresentation(ticket);

    return {
        ...ticket.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

const skipTicket = async (id, reason = '', counterId, staffId = null) => {
    if (counterId) await ensureCounterActive(counterId);

    const ticket = await Ticket.findById(id)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể bỏ qua. Chỉ bỏ qua được ticket đang xử lý`);
    }

    const currentCounterId = counterId || ticket.counterId;

    if (counterId && String(ticket.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép bỏ qua ticket của quầy được gán');
    }

    if (staffId && currentCounterId) {
        await assertStaffCanHandleService(staffId, currentCounterId, ticket.serviceId?._id || ticket.serviceId);
    }

    ticket.skipCount = (ticket.skipCount || 0) + 1;
    ticket.skippedAt = new Date();
    ticket.counterId = null;
    ticket.staffId = null;
    ticket.serviceCounterId = null;
    ticket.processingAt = null;

    if (ticket.skipCount >= MAX_RECALL_SKIP_COUNT) {
        ticket.isRecall = false;
        ticket.recalledAt = null;
        ticket.recallCounterId = null;
        ticket.status = TicketStatus.SKIPPED;
    } else {
        ticket.isRecall = true;
        ticket.recalledAt = ticket.skippedAt;
        ticket.recallCounterId = currentCounterId;
        ticket.status = TicketStatus.WAITING;
    }

    if (reason) {
        ticket.note = reason;
    }

    await ticket.save();

    if (currentCounterId) {
        await refreshCounterCurrentTicket(currentCounterId);
    }

    emitTicketSkipped(ticket, currentCounterId);

    await emitStaffDisplayUpdateForCounters(
        currentCounterId ? [currentCounterId] : [],
        'ticket-skipped',
        {
            ticketId: ticket._id
        }
    );

    await emitDashboardUpdateSafe('ticket-skipped');

    const presentation = buildTicketPresentation(ticket);

    return {
        ...ticket.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

const backToWaiting = async (ticketId, counterId, staffId = null, position = 'front') => {
    const counter = await ensureCounterActive(counterId);
    const accessScope = await getServiceAccessScope(counterId, staffId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticket = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticket.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticket.status}, không thể trả về hàng chờ. Chỉ áp dụng với ticket đang xử lý`);
    }

    if (String(ticket.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép trả ticket của quầy được gán về hàng chờ');
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticket.serviceId?._id || ticket.serviceId);
    }

    const priorityTime = position === 'back' ? new Date() : new Date(0);
    const previousCounterId = ticket.counterId;
    const returnedToWaitingAt = new Date();

    ticket.status = TicketStatus.WAITING;
    ticket.counterId = null;
    ticket.staffId = null;
    ticket.serviceCounterId = null;
    ticket.processingAt = null;
    ticket.isRecall = false;
    ticket.recalledAt = null;
    ticket.recallCounterId = null;
    ticket.createdAt = priorityTime;
    ticket.set('returnedToWaitingAt', returnedToWaitingAt, { strict: false });

    await ticket.save();
    await Ticket.updateOne(
        { _id: ticket._id },
        {
            $set: {
                createdAt: priorityTime,
                returnedToWaitingAt
            }
        },
        {
            strict: false,
            timestamps: false
        }
    );

    ticket.createdAt = priorityTime;
    ticket.set('returnedToWaitingAt', returnedToWaitingAt, { strict: false });

    await refreshCounterCurrentTicket(previousCounterId);

    emitTicketBackToWaiting(ticket, counter, position);

    await emitStaffDisplayUpdateForCounters([previousCounterId], 'ticket-back-to-waiting', {
        ticketId: ticket._id
    });

    await emitDashboardUpdateSafe('ticket-back-to-waiting');

    const presentation = buildTicketPresentation(ticket);

    return {
        ...ticket.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

module.exports = {
    backToWaiting,
    callById,
    callNext,
    cancelRecallTicket,
    completeTicket,
    createTicket,
    recallProcessingTicket,
    recallTicket,
    skipTicket
};
