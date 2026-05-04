const mongoose = require('mongoose');
const Ticket = require('../../models/ticket.model');
const Service = require('../../models/service.model');
const Counter = require('../../models/counter.model');
const ServiceCounter = require('../../models/serviceCounter.model');
const CounterSequence = require('../../models/counterSequence.model');
const { TicketStatus } = require('../../constants/enums');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/Logger');
const { emitDashboardUpdateSafe } = require('../dashboard.service');
const { generateQRData } = require('../../utils/qrData.util');
const { getStaffServiceAccess, assertStaffCanHandleService, ensureStaffHasAccessibleServices } = require('../staff-permission.service');
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

const MAX_RECALLABLE_SKIP_COUNT = 1;

const canAccessService = (serviceIds, serviceId) => serviceIds.includes(String(serviceId));


const ensureCounterActive = async (counterId) => {
    const counter = await Counter.findById(counterId);
    if (!counter?.isActive) {
        throw new ApiError(400, 'Quầy không tồn tại hoặc không hoạt động');
    }

    return counter;
};

const ensureNoProcessingTicket = async (counterId, staffId = null) => {
    const query = staffId
        ? { staffId, counterId, status: TicketStatus.PROCESSING }
        : { counterId, status: TicketStatus.PROCESSING };

    const existingProcessing = await Ticket.findOne(query)
        .populate('serviceId', 'name code prefixNumber');

    if (existingProcessing) {
        const presentation = buildTicketPresentation(existingProcessing);
        if (staffId) {
            throw new ApiError(400, `Bạn đang xử lý vé ${presentation.formattedNumber}. Vui lòng hoàn thành hoặc bỏ qua vé hiện tại trước`);
        }

        throw new ApiError(400, `Quầy đang xử lý vé ${presentation.formattedNumber}. Vui lòng hoàn thành hoặc bỏ qua vé hiện tại trước`);
    }
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

    if (!service.isOpen) {
        throw new ApiError(400, `Dịch vụ ${service.name} hiện đang tạm đóng. Vui lòng quay lại sau.`);
    }

    const dupWindowSec = Number(process.env.DUPLICATE_TICKET_WINDOW_SECONDS) || 45;
    if (dupWindowSec > 0) {
        const dupSince = new Date(Date.now() - dupWindowSec * 1000);
        const duplicate = await Ticket.findOne({
            serviceId,
            phone,
            status: { $in: [TicketStatus.WAITING, TicketStatus.PROCESSING] },
            createdAt: { $gte: dupSince }
        }).select('_id');

        if (duplicate) {
            throw new ApiError(409, 'Bạn vừa lấy số gần đây. Vui lòng đợi thêm hoặc dùng vé đã cấp.');
        }
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
        serviceId,
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

    logger.info({
        action: 'ticket-created',
        ticketId: String(ticket._id),
        serviceId: String(serviceId),
        queueCounterId: String(issueCounter._id),
        displayNumber
    });

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

    const accessScope = await getStaffServiceAccess(staffId, counterId);
    ensureStaffHasAccessibleServices(accessScope);

    if (accessScope.allowedServiceIds.length === 0) {
        throw new ApiError(400, 'Quầy chưa được gán dịch vụ');
    }

    await ensureNoProcessingTicket(counterId, staffId);

    const calledTime = new Date();
    const allowedObjectIds = accessScope.allowedServiceIds.map((id) => new mongoose.Types.ObjectId(id));

    let nextTicket = await Ticket.findOneAndUpdate(
        {
            queueCounterId: counterId,
            serviceId: { $in: allowedObjectIds },
            status: TicketStatus.WAITING,
            counterId: null,
            isRecall: false
        },
        {
            $set: {
                status: TicketStatus.PROCESSING,
                counterId,
                staffId: staffId || null,
                recalledAt: null,
                isRecall: false,
                calledAt: calledTime,
                processingAt: calledTime,
                skippedAt: null
            }
        },
        {
            sort: { createdAt: 1, number: 1 },
            new: true
        }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!nextTicket) {
        throw new ApiError(404, 'Không có ticket đang chờ trong danh sách dịch vụ được phân quyền');
    }

    if (staffId) {
        try {
            await assertStaffCanHandleService(staffId, counterId, nextTicket.serviceId._id);
        } catch (error) {
            await Ticket.findByIdAndUpdate(nextTicket._id, {
                $set: {
                    status: TicketStatus.WAITING,
                    counterId: null,
                    staffId: null,
                    calledAt: null,
                    processingAt: null,
                    skippedAt: null,
                    waitingDuration: 0
                }
            });
            throw error;
        }
    }

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: nextTicket.serviceId._id,
        counterId,
        isActive: true
    });

    nextTicket.serviceCounterId = serviceCounter?._id || null;
    nextTicket.waitingDuration = getDurationInSeconds(nextTicket.createdAt, calledTime);
    await nextTicket.save();

    counter.currentTicketId = nextTicket._id;
    await counter.save();

    logger.info({
        action: 'call-next',
        ticketId: String(nextTicket._id),
        counterId: String(counterId),
        staffId: staffId ? String(staffId) : null
    });

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
    const accessScope = await getStaffServiceAccess(staffId, counterId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticketPreview = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .populate('counterId', 'name number');

    if (!ticketPreview) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (ticketPreview.status !== TicketStatus.WAITING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticketPreview.status}, không thể gọi. Chỉ có thể gọi ticket đang chờ`);
    }

    if (!canAccessService(accessScope.allowedServiceIds, ticketPreview.serviceId?._id || ticketPreview.serviceId)) {
        const serviceName = ticketPreview.serviceId?.name || 'không xác định';
        throw new ApiError(403, `Bạn không có quyền xử lý dịch vụ ${serviceName}`);
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticketPreview.serviceId._id);
    }

    const belongsToCounter = ticketPreview.isRecall
        ? String(ticketPreview.recallCounterId || '') === String(counterId)
        : String(ticketPreview.queueCounterId?._id || ticketPreview.queueCounterId || '') === String(counterId);

    if (!belongsToCounter) {
        throw new ApiError(403, `Ticket không thuộc danh sách xử lý của quầy ${counter.name}`);
    }

    await ensureNoProcessingTicket(counterId, staffId);

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: ticketPreview.serviceId._id,
        counterId,
        isActive: true
    });

    const allowedObjectIds = accessScope.allowedServiceIds.map((id) => new mongoose.Types.ObjectId(id));
    const calledTime = new Date();

    const recallMatch = ticketPreview.isRecall
        ? { isRecall: true, recallCounterId: counterId }
        : { isRecall: false, queueCounterId: counterId };

    const ticket = await Ticket.findOneAndUpdate(
        {
            _id: ticketId,
            status: TicketStatus.WAITING,
            counterId: null,
            serviceId: { $in: allowedObjectIds },
            ...recallMatch
        },
        {
            $set: {
                isRecall: false,
                recalledAt: null,
                recallCounterId: null,
                status: TicketStatus.PROCESSING,
                counterId,
                staffId: staffId || null,
                calledAt: calledTime,
                processingAt: calledTime,
                skippedAt: null,
                serviceCounterId: serviceCounter?._id || null,
                waitingDuration: getDurationInSeconds(ticketPreview.createdAt, calledTime)
            }
        },
        { new: true }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number')
        .populate('counterId', 'name number');

    if (!ticket) {
        throw new ApiError(409, 'Ticket không còn ở trạng thái chờ hoặc đã được quầy khác gọi');
    }

    counter.currentTicketId = ticket._id;
    await counter.save();

    logger.info({
        action: 'call-by-id',
        ticketId: String(ticket._id),
        counterId: String(counterId),
        staffId: staffId ? String(staffId) : null
    });

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

    const accessScope = await getStaffServiceAccess(staffId, counterId);
    ensureStaffHasAccessibleServices(accessScope);

    const ticketPreview = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticketPreview) {
        throw new ApiError(404, 'Ticket không tồn tại');
    }

    if (ticketPreview.status !== TicketStatus.WAITING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${ticketPreview.status}, không thể gọi lại. Chỉ gọi lại được ticket đang chờ`);
    }

    if (!ticketPreview.isRecall || String(ticketPreview.recallCounterId) !== String(counterId)) {
        throw new ApiError(400, `Ticket không nằm trong danh sách gọi lại của quầy ${counter.name}`);
    }

    if (staffId) {
        await assertStaffCanHandleService(staffId, counterId, ticketPreview.serviceId?._id || ticketPreview.serviceId);
    }

    await ensureNoProcessingTicket(counterId, staffId);

    const serviceCounter = await ServiceCounter.findOne({
        serviceId: ticketPreview.serviceId._id,
        counterId,
        isActive: true
    });

    const calledTime = new Date();
    const calledAtValue = ticketPreview.calledAt || calledTime;
    const waitingDurationValue = ticketPreview.calledAt
        ? ticketPreview.waitingDuration
        : getDurationInSeconds(ticketPreview.createdAt, calledTime);

    const allowedObjectIds = accessScope.allowedServiceIds.map((id) => new mongoose.Types.ObjectId(id));

    const ticket = await Ticket.findOneAndUpdate(
        {
            _id: ticketId,
            status: TicketStatus.WAITING,
            isRecall: true,
            recallCounterId: counterId,
            serviceId: { $in: allowedObjectIds }
        },
        {
            $set: {
                isRecall: false,
                recalledAt: null,
                recallCounterId: null,
                status: TicketStatus.PROCESSING,
                counterId,
                staffId: staffId || null,
                calledAt: calledAtValue,
                processingAt: calledTime,
                skippedAt: null,
                serviceCounterId: serviceCounter?._id || null,
                waitingDuration: waitingDurationValue
            }
        },
        { new: true }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(409, 'Không thể gọi lại ticket do trạng thái đã thay đổi');
    }

    counter.currentTicketId = ticket._id;
    await counter.save();

    logger.info({
        action: 'recall-ticket',
        ticketId: String(ticket._id),
        counterId: String(counterId),
        staffId: staffId ? String(staffId) : null
    });

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
    const accessScope = await getStaffServiceAccess(staffId, counterId);
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

    await Ticket.findByIdAndUpdate(ticketId, { $currentDate: { updatedAt: true } });

    logger.info({
        action: 'recall-processing',
        ticketId: String(ticket._id),
        counterId: String(counterId),
        staffId: staffId ? String(staffId) : null
    });

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

    const accessScope = await getStaffServiceAccess(staffId, counterId);
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

    const skippedAt = new Date();
    const updated = await Ticket.findOneAndUpdate(
        {
            _id: ticketId,
            status: TicketStatus.WAITING,
            isRecall: true,
            recallCounterId: counterId
        },
        {
            $set: {
                isRecall: false,
                recalledAt: null,
                recallCounterId: null,
                status: TicketStatus.SKIPPED,
                counterId: null,
                staffId: null,
                serviceCounterId: null,
                processingAt: null,
                skippedAt,
                ...(reason ? { note: reason } : {})
            }
        },
        { new: true }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!updated) {
        throw new ApiError(409, 'Không thể hủy gọi lại do trạng thái ticket đã thay đổi');
    }

    logger.info({
        action: 'cancel-recall',
        ticketId: String(updated._id),
        counterId: String(counterId),
        staffId: staffId ? String(staffId) : null
    });

    emitTicketRecallCancelled(updated);

    await emitStaffDisplayUpdateForCounters([counterId], 'ticket-recall-cancelled', {
        ticketId: updated._id
    });

    await emitDashboardUpdateSafe('ticket-recall-cancelled');

    const presentation = buildTicketPresentation(updated);

    return {
        ...updated.toObject(),
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber
    };
};

const completeTicket = async (ticketId, counterId = null, staffId = null) => {
    if (counterId) await ensureCounterActive(counterId);

    const preview = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!preview) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (preview.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${preview.status}, không thể hoàn thành. Chỉ hoàn thành được ticket đang xử lý`);
    }

    if (counterId && String(preview.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép hoàn thành ticket của quầy được gán');
    }

    if (staffId && counterId) {
        await assertStaffCanHandleService(staffId, counterId, preview.serviceId?._id || preview.serviceId);
    }

    const completedAt = new Date();
    const processingAnchor = preview.calledAt || preview.processingAt || preview.createdAt;
    const processingDuration = getDurationInSeconds(processingAnchor, completedAt);
    const totalDuration = getDurationInSeconds(preview.createdAt, completedAt);
    const completedByStaffId = preview.staffId;

    const atomicFilter = {
        _id: ticketId,
        status: TicketStatus.PROCESSING
    };

    if (counterId) {
        atomicFilter.counterId = counterId;
    }

    const ticket = await Ticket.findOneAndUpdate(
        atomicFilter,
        {
            $set: {
                status: TicketStatus.COMPLETED,
                completedAt,
                qrData: null,
                isRecall: false,
                recalledAt: null,
                recallCounterId: null,
                completedByStaffId,
                staffId: null,
                processingDuration,
                totalDuration
            }
        },
        { new: true }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(409, 'Không thể hoàn thành ticket do trạng thái đã thay đổi');
    }

    logger.info({
        action: 'ticket-completed',
        ticketId: String(ticket._id),
        counterId: ticket.counterId ? String(ticket.counterId) : null,
        staffId: staffId ? String(staffId) : null
    });

    emitTicketCompleted(ticket);

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

const skipTicket = async (ticketId, reason = '', counterId, staffId = null) => {
    if (counterId) await ensureCounterActive(counterId);

    const preview = await Ticket.findById(ticketId)
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!preview) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }

    if (preview.status !== TicketStatus.PROCESSING) {
        throw new ApiError(400, `Ticket đang ở trạng thái ${preview.status}, không thể bỏ qua. Chỉ bỏ qua được ticket đang xử lý`);
    }

    const currentCounterId = counterId || preview.counterId;

    if (counterId && String(preview.counterId) !== String(counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép bỏ qua ticket của quầy được gán');
    }

    if (staffId && currentCounterId) {
        await assertStaffCanHandleService(staffId, currentCounterId, preview.serviceId?._id || preview.serviceId);
    }

    const priorSkip = preview.skipCount || 0;
    const newSkipCount = priorSkip + 1;
    const skippedAt = new Date();
    const closeAsSkipped = newSkipCount > MAX_RECALLABLE_SKIP_COUNT;

    const recallFields = closeAsSkipped
        ? {
            isRecall: false,
            recalledAt: null,
            recallCounterId: null,
            status: TicketStatus.SKIPPED
        }
        : {
            isRecall: true,
            recalledAt: skippedAt,
            recallCounterId: currentCounterId,
            status: TicketStatus.WAITING
        };

    const ticket = await Ticket.findOneAndUpdate(
        {
            _id: ticketId,
            status: TicketStatus.PROCESSING,
            counterId: preview.counterId,
            skipCount: priorSkip
        },
        {
            $set: {
                skipCount: newSkipCount,
                skippedAt,
                counterId: null,
                staffId: null,
                serviceCounterId: null,
                processingAt: null,
                ...recallFields,
                ...(reason ? { note: reason } : {})
            }
        },
        { new: true }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!ticket) {
        throw new ApiError(409, 'Không thể bỏ qua ticket do trạng thái đã thay đổi');
    }

    logger.info({
        action: 'ticket-skipped',
        ticketId: String(ticket._id),
        counterId: currentCounterId ? String(currentCounterId) : null,
        staffId: staffId ? String(staffId) : null,
        newSkipCount
    });

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
    const accessScope = await getStaffServiceAccess(staffId, counterId);
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

    const previousCounterId = ticket.counterId;
    const returnedToWaitingAt = new Date();

    const updated = await Ticket.findOneAndUpdate(
        {
            _id: ticketId,
            status: TicketStatus.PROCESSING,
            counterId
        },
        {
            $set: {
                status: TicketStatus.WAITING,
                counterId: null,
                staffId: null,
                serviceCounterId: null,
                processingAt: null,
                isRecall: false,
                recalledAt: null,
                recallCounterId: null,
                returnedToWaitingAt,
                ...(position === 'end' ? { createdAt: returnedToWaitingAt } : {})
            }
        },
        { new: true }
    )
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    if (!updated) {
        throw new ApiError(409, 'Không thể trả vé về hàng chờ do trạng thái đã thay đổi');
    }

    await refreshCounterCurrentTicket(previousCounterId);

    logger.info({
        action: 'ticket-back-to-waiting',
        ticketId: String(updated._id),
        counterId: String(counterId),
        staffId: staffId ? String(staffId) : null
    });

    emitTicketBackToWaiting(updated, counter, position);

    await emitStaffDisplayUpdateForCounters([previousCounterId], 'ticket-back-to-waiting', {
        ticketId: updated._id
    });

    await emitDashboardUpdateSafe('ticket-back-to-waiting');

    const presentation = buildTicketPresentation(updated);

    return {
        ...updated.toObject(),
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
    refreshCounterCurrentTicket,
    skipTicket
};