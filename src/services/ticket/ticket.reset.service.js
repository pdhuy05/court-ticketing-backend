const mongoose = require('mongoose');
const Counter = require('../../models/counter.model');
const ServiceCounter = require('../../models/serviceCounter.model');
const CounterSequence = require('../../models/counterSequence.model');
const Ticket = require('../../models/ticket.model');
const { TicketStatus } = require('../../constants/enums');
const logger = require('../../utils/Logger');
const { emitDashboardUpdateSafe } = require('../dashboard.service');
const { calculateDailyStatistics } = require('../statistics.service');
const { getDateRange } = require('./ticket.helpers');
const { getLastIssuedByCounter } = require('./ticket.query.service');
const {
    emitStaffDisplayUpdateForCounters,
    emitTicketsResetAll,
    emitTicketsResetDay
} = require('./ticket.socket');

const resetCounterSequences = async (counterIds = null) => {
    const query = counterIds?.length
        ? { counterId: { $in: counterIds } }
        : {};

    const result = await CounterSequence.updateMany(query, {
        $set: { lastNumber: 0 }
    });

    logger.info({
        action: 'reset-counter-sequences',
        modifiedCount: result.modifiedCount || 0,
        counterIdsCount: counterIds?.length || 0
    });

    return result;
};

const getAffectedCounterIds = async () => {
    const counterIds = await ServiceCounter.find({ isActive: true }).distinct('counterId');
    return counterIds.map((counterId) => String(counterId));
};

/** Không reset bộ đếm phát số cho quầy đang còn vé waiting/processing (tránh trùng số). */
const filterIssueCountersSafeForSequenceReset = async (issueCounterIdStrings) => {
    if (!issueCounterIdStrings?.length) {
        return [];
    }

    const oidList = issueCounterIdStrings.map((id) => new mongoose.Types.ObjectId(id));

    const busyIssuers = await Ticket.distinct('queueCounterId', {
        queueCounterId: { $in: oidList, $ne: null },
        status: { $in: [TicketStatus.WAITING, TicketStatus.PROCESSING] }
    });

    const busy = new Set(busyIssuers.map(String));
    const skipped = issueCounterIdStrings.filter((id) => busy.has(String(id)));
    const safe = issueCounterIdStrings.filter((id) => !busy.has(String(id)));

    if (skipped.length > 0) {
        logger.warning({
            action: 'reset-sequences-skipped-busy-counters',
            skippedIssueCounterIds: skipped,
            skippedCount: skipped.length
        });
    }

    return safe;
};

const resetTicketsByDate = async (dateString, actor) => {
    const { start, end, formattedDate } = getDateRange(dateString);
    const affectedCounterIds = await getAffectedCounterIds();
    await calculateDailyStatistics(start, end, actor);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const shouldResetSequences = targetDay.getTime() >= yesterday.getTime();

    let resetCount = 0;

    let safeSequenceCounterIds = [];

    if (shouldResetSequences) {
        await Counter.updateMany({}, { currentTicketId: null });
        safeSequenceCounterIds = await filterIssueCountersSafeForSequenceReset(affectedCounterIds);
        const sequenceResult = await resetCounterSequences(safeSequenceCounterIds);
        resetCount = sequenceResult.modifiedCount || 0;

        logger.info({
            action: 'tickets-reset-day',
            date: formattedDate,
            resetCount,
            safeSequenceCounters: safeSequenceCounterIds.length,
            totalServiceCounters: affectedCounterIds.length
        });
    }

    const lastIssuedByCounter = await getLastIssuedByCounter();

    if (shouldResetSequences) {
        emitTicketsResetDay({
            date: formattedDate,
            deletedCount: resetCount,
            lastIssuedByCounter,
            counterIds: affectedCounterIds
        });

        await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-day', {
            date: formattedDate,
            resetCount,
            sequencesResetForCounters: safeSequenceCounterIds.length
        });
    }

    await emitDashboardUpdateSafe('tickets-reset-day');

    return {
        date: formattedDate,
        resetCount,
        counterCount: affectedCounterIds.length,
        sequencesResetForCounters: safeSequenceCounterIds.length
    };
};

const resetAllTickets = async (actor) => {
    const { start, end } = getDateRange();
    await calculateDailyStatistics(start, end, actor);

    const affectedCounterIds = await getAffectedCounterIds();
    await Counter.updateMany({}, { currentTicketId: null });
    const safeSequenceCounterIds = await filterIssueCountersSafeForSequenceReset(affectedCounterIds);
    const sequenceResult = await resetCounterSequences(safeSequenceCounterIds);
    const lastIssuedByCounter = await getLastIssuedByCounter();
    const resetCount = sequenceResult.modifiedCount || 0;

    logger.info({
        action: 'tickets-reset-all',
        resetCount,
        safeSequenceCounters: safeSequenceCounterIds.length,
        totalServiceCounters: affectedCounterIds.length
    });

    emitTicketsResetAll({
        deletedCount: resetCount,
        lastIssuedByCounter
    });

    await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-all', {
        resetCount,
        sequencesResetForCounters: safeSequenceCounterIds.length
    });

    await emitDashboardUpdateSafe('tickets-reset-all');

    return {
        resetCount,
        sequencesResetForCounters: safeSequenceCounterIds.length
    };
};

module.exports = {
    resetAllTickets,
    resetCounterSequences,
    resetTicketsByDate
};
