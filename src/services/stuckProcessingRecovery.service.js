const Ticket = require('../models/ticket.model');
const Counter = require('../models/counter.model');
const { TicketStatus } = require('../constants/enums');
const logger = require('../utils/Logger');
const { refreshCounterCurrentTicket } = require('./ticket/ticket.action.service');
const { emitDashboardUpdateSafe } = require('./dashboard.service');
const {
    emitStaffDisplayUpdateForCounters,
    emitTicketBackToWaiting
} = require('./ticket/ticket.socket');

let _intervalId = null;

const getStuckThresholdMs = () => {
    const minutes = Number(process.env.STUCK_TICKET_MINUTES);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 45;
    return safeMinutes * 60 * 1000;
};

const releaseStuckProcessingTickets = async () => {
    const thresholdMs = getStuckThresholdMs();
    const cutoff = new Date(Date.now() - thresholdMs);

    const stuck = await Ticket.find({
        status: TicketStatus.PROCESSING,
        processingAt: { $lt: cutoff, $ne: null },
        counterId: { $ne: null }
    })
        .select('_id counterId')
        .lean();

    if (stuck.length === 0) {
        return;
    }

    const ids = stuck.map((row) => row._id);
    const counterIdByTicket = new Map(stuck.map((row) => [String(row._id), row.counterId]));
    const releasedAt = new Date();

    const updateResult = await Ticket.updateMany(
        {
            _id: { $in: ids },
            status: TicketStatus.PROCESSING,
            processingAt: { $lt: cutoff }
        },
        {
            $set: {
                status: TicketStatus.WAITING,
                counterId: null,
                staffId: null,
                serviceCounterId: null,
                calledAt: null,
                processingAt: null,
                isRecall: false,
                recalledAt: null,
                recallCounterId: null,
                returnedToWaitingAt: releasedAt,
                skipCount: 0
            }
        }
    );

    const affectedCounterIds = [...new Set(
        stuck.map((row) => (row.counterId ? String(row.counterId) : null)).filter(Boolean)
    )];

    for (const cid of affectedCounterIds) {
        await refreshCounterCurrentTicket(cid);
    }

    logger.info({
        action: 'stuck-processing-released',
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        thresholdMinutes: thresholdMs / 60000,
        affectedCounterIds
    });

    const released = await Ticket.find({
        _id: { $in: ids },
        status: TicketStatus.WAITING,
        returnedToWaitingAt: releasedAt
    })
        .populate('serviceId', 'name code prefixNumber')
        .populate('queueCounterId', 'number');

    for (const ticket of released) {
        const prevCounterId = counterIdByTicket.get(String(ticket._id));
        if (!prevCounterId) {
            continue;
        }

        const counter = await Counter.findById(prevCounterId);
        if (counter) {
            emitTicketBackToWaiting(ticket, counter, 'end');
        }
    }

    if (affectedCounterIds.length > 0) {
        await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'ticket-stuck-released', {
            releasedCount: updateResult.modifiedCount || 0
        });
    }

    if (updateResult.modifiedCount > 0) {
        await emitDashboardUpdateSafe('ticket-stuck-released');
    }
};

const start = async () => {
    if (_intervalId) {
        return;
    }

    const intervalMs = Number(process.env.STUCK_TICKET_CHECK_INTERVAL_MS) || 5 * 60 * 1000;

    await releaseStuckProcessingTickets();

    _intervalId = setInterval(() => {
        releaseStuckProcessingTickets().catch((error) => {
            logger.error(`stuckProcessingRecovery: ${error.message}`);
        });
    }, intervalMs);

    logger.info('Đã khởi động scheduler giải phóng ticket processing bị kẹt');
};

const stop = () => {
    if (_intervalId) {
        clearInterval(_intervalId);
        _intervalId = null;
        logger.info('Đã dừng scheduler giải phóng ticket processing bị kẹt');
    }
};

module.exports = {
    releaseStuckProcessingTickets,
    start,
    stop
};