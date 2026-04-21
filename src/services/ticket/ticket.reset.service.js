const Ticket = require('../../models/ticket.model');
const Service = require('../../models/service.model');
const Counter = require('../../models/counter.model');
const ServiceCounter = require('../../models/serviceCounter.model');
const CounterSequence = require('../../models/counterSequence.model');
const { emitDashboardUpdateSafe } = require('../dashboard.service');
const { writeBackup } = require('../ticket-backup.service');
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

    const ticketIds = tickets.map((ticket) => ticket._id);
    const counterIds = [
        ...new Set(
            tickets
                .filter((ticket) => ticket.counterId)
                .map((ticket) => String(ticket.counterId))
        )
    ];
    const serviceIds = [
        ...new Set(
            tickets
                .filter((ticket) => ticket.serviceId)
                .map((ticket) => String(ticket.serviceId))
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

    await calculateDailyStatistics(start, end, actor);

    await Counter.updateMany(
        { currentTicketId: { $in: ticketIds } },
        { currentTicketId: null }
    );

    await Ticket.deleteMany({
        _id: { $in: ticketIds }
    });

    await resetCounterSequences(affectedCounterIds);
    const lastIssuedByCounter = await getLastIssuedByCounter();

    emitTicketsResetDay({
        date: formattedDate,
        deletedCount: ticketIds.length,
        lastIssuedByCounter,
        counterIds
    });

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
                .filter((ticket) => ticket.counterId)
                .map((ticket) => String(ticket.counterId))
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

    emitTicketsResetAll({
        deletedCount,
        lastIssuedByCounter
    });

    await emitStaffDisplayUpdateForCounters(affectedCounterIds, 'tickets-reset-all', {
        deletedCount
    });

    await emitDashboardUpdateSafe('tickets-reset-all');

    return {
        deletedCount,
        backup
    };
};

module.exports = {
    buildResetBackupPayload,
    resetAllTickets,
    resetCounterSequences,
    resetTicketsByDate
};
