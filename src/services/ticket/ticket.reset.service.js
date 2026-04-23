const Counter = require('../../models/counter.model');
const ServiceCounter = require('../../models/serviceCounter.model');
const CounterSequence = require('../../models/counterSequence.model');
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

    console.log(`Đã reset ${result.modifiedCount || 0} counter sequences về 0`);

    return result;
};

const getAffectedCounterIds = async () => {
    const counterIds = await ServiceCounter.find({ isActive: true }).distinct('counterId');
    return counterIds.map((counterId) => String(counterId));
};

const resetTicketsByDate = async (dateString, actor) => {
    const { start, end, formattedDate } = getDateRange(dateString);
    const affectedCounterIds = await getAffectedCounterIds();
    await calculateDailyStatistics(start, end, actor);
    await Counter.updateMany({}, { currentTicketId: null });
    const sequenceResult = await resetCounterSequences(affectedCounterIds);
    const lastIssuedByCounter = await getLastIssuedByCounter();
    const resetCount = sequenceResult.modifiedCount || 0;

    emitTicketsResetDay({
        date: formattedDate,
        deletedCount: resetCount,
        lastIssuedByCounter,
        counterIds: affectedCounterIds
    });

    await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-day', {
        date: formattedDate,
        resetCount
    });

    await emitDashboardUpdateSafe('tickets-reset-day');

    return {
        date: formattedDate,
        resetCount,
        counterCount: affectedCounterIds.length
    };
};

const resetAllTickets = async (actor) => {
    const affectedCounterIds = await getAffectedCounterIds();
    await Counter.updateMany({}, { currentTicketId: null });
    const sequenceResult = await resetCounterSequences(affectedCounterIds);
    const lastIssuedByCounter = await getLastIssuedByCounter();
    const resetCount = sequenceResult.modifiedCount || 0;

    emitTicketsResetAll({
        deletedCount: resetCount,
        lastIssuedByCounter
    });

    await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-all', {
        resetCount
    });

    await emitDashboardUpdateSafe('tickets-reset-all');

    return {
        resetCount
    };
};

module.exports = {
    resetAllTickets,
    resetCounterSequences,
    resetTicketsByDate
};
