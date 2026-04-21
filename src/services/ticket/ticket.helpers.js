const parseTargetDate = (dateString) => {
    if (!dateString) {
        return new Date();
    }

    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const getDateRange = (dateString) => {
    const targetDate = parseTargetDate(dateString);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const formattedDate = [
        start.getFullYear(),
        String(start.getMonth() + 1).padStart(2, '0'),
        String(start.getDate()).padStart(2, '0')
    ].join('-');

    return { start, end, formattedDate };
};

const normalizeCounterId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value._id) {
        return String(value._id);
    }

    return String(value);
};

const extractCounterIdsFromRelations = (relations = []) => {
    return relations
        .map((relation) => normalizeCounterId(relation.counterId))
        .filter(Boolean);
};

const formatQueueNumber = (number) => String(number).padStart(3, '0');

const formatCounterDisplayNumber = (counterNumber, ticketNumber) => {
    if (!counterNumber) {
        return formatQueueNumber(ticketNumber);
    }

    return `${counterNumber}${formatQueueNumber(ticketNumber)}`;
};

const formatServiceDisplayNumber = (servicePrefix, ticketNumber) => {
    const prefix = Number(servicePrefix);
    const formattedNumber = String(ticketNumber).padStart(3, '0');

    if (!Number.isFinite(prefix) || prefix <= 0) {
        return formattedNumber;
    }

    return `${prefix}${formattedNumber}`;
};

const getPrimaryCounter = (counterRefs = []) => {
    const counters = counterRefs
        .map((counterRef) => counterRef?.counterId || counterRef)
        .filter(Boolean)
        .sort((a, b) => (a.number || 0) - (b.number || 0));

    return counters[0] || null;
};

const resolveDisplayCounter = (ticket, fallbackCounter = null) => {
    if (ticket.queueCounterId?.number) {
        return ticket.queueCounterId;
    }

    if (fallbackCounter?.number) {
        return fallbackCounter;
    }

    if (ticket.counterId?.number) {
        return ticket.counterId;
    }

    return null;
};

const buildTicketPresentation = (ticket, counter = null) => {
    let formattedNumber;

    if (ticket.displayUsesServicePrefix === true) {
        const prefix = ticket.serviceId?.prefixNumber;
        formattedNumber = formatServiceDisplayNumber(
            typeof prefix === 'number' ? prefix : 0,
            ticket.number
        );
    } else {
        const normalizedCounter = resolveDisplayCounter(ticket, counter);
        formattedNumber = normalizedCounter?.number
            ? formatCounterDisplayNumber(normalizedCounter.number, ticket.number)
            : formatQueueNumber(ticket.number);
    }

    return {
        id: ticket._id,
        _id: ticket._id,
        number: ticket.number,
        ticketNumber: ticket.ticketNumber,
        formattedNumber,
        displayNumber: formattedNumber,
        customerName: ticket.name,
        phone: ticket.phone,
        status: ticket.status,
        serviceName: ticket.serviceId?.name,
        createdAt: ticket.createdAt
    };
};

const getDurationInSeconds = (from, to = new Date()) => {
    if (!from || !to) {
        return 0;
    }

    const diff = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000);
    return diff > 0 ? diff : 0;
};

module.exports = {
    parseTargetDate,
    getDateRange,
    normalizeCounterId,
    extractCounterIdsFromRelations,
    formatQueueNumber,
    formatCounterDisplayNumber,
    formatServiceDisplayNumber,
    getPrimaryCounter,
    resolveDisplayCounter,
    buildTicketPresentation,
    getDurationInSeconds
};
