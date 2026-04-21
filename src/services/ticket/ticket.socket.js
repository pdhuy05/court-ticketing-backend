const User = require('../../models/user.model');
const { TicketStatus } = require('../../constants/enums');
const { emitGlobal, emitToRoom, hasIO } = require('../../utils/socketEmitter');
const { buildTicketPresentation } = require('./ticket.helpers');
const { getStaffDisplay } = require('./ticket.query.service');

const emitStaffDisplayUpdateForCounters = async (counterIds, reason, extra = {}) => {
    if (!hasIO() || !counterIds?.length) {
        return;
    }

    const uniqueCounterIds = [...new Set(counterIds.map((counterId) => String(counterId)))];

    await Promise.all(
        uniqueCounterIds.map(async (counterId) => {
            try {
                emitToRoom(`counter-${counterId}`, 'staff-display-updated', {
                    reason,
                    counterId,
                    updatedAt: new Date().toISOString(),
                    data: await getStaffDisplay(counterId),
                    ...extra
                });

                const staffs = await User.find({
                    role: 'staff',
                    isActive: true,
                    counterId
                }).select('_id');

                await Promise.all(
                    staffs.map(async (staff) => {
                        const staffId = String(staff._id);

                        emitToRoom(`staff-display-${staffId}`, 'staff-display-updated', {
                            reason,
                            counterId,
                            staffId,
                            updatedAt: new Date().toISOString(),
                            data: await getStaffDisplay(counterId, staffId),
                            ...extra
                        });
                    })
                );
            } catch (error) {
                console.error(`Không thể cập nhật staff display cho quầy ${counterId}: ${error.message}`);
            }
        })
    );
};

const emitTicketCalled = async (ticket, counter, reason = 'ticket-called') => {
    if (!hasIO()) {
        return;
    }

    const formattedNumber = buildTicketPresentation(ticket, counter).formattedNumber;

    emitToRoom('waiting-room', 'ticket-called', {
        ticket: {
            id: ticket._id,
            number: ticket.number,
            formattedNumber,
            customerName: ticket.name,
            serviceName: ticket.serviceId.name,
            isRecall: ticket.isRecall
        },
        counterName: counter.name,
        counterId: counter._id,
        calledAt: new Date(),
        reason
    });

    emitToRoom(`counter-${counter._id}`, 'new-current-ticket', {
        currentTicket: {
            id: ticket._id,
            number: ticket.number,
            formattedNumber,
            customerName: ticket.name,
            phone: ticket.phone,
            serviceName: ticket.serviceId.name,
            status: TicketStatus.PROCESSING
        }
    });
};

const emitWaitingRoomNewTicket = ({ ticket, service, displayNumber, totalWaiting, lastIssuedByCounter }) => {
    if (!hasIO()) {
        return;
    }

    emitToRoom('waiting-room', 'new-ticket', {
        ticket: {
            id: ticket._id,
            number: ticket.number,
            formattedNumber: displayNumber,
            displayNumber,
            customerName: ticket.name,
            phone: ticket.phone,
            serviceName: service.name,
            status: ticket.status
        },
        totalWaiting,
        lastIssuedByCounter
    });
};

const emitTicketRecalled = (ticket, counter) => {
    if (!hasIO()) {
        return;
    }

    const formattedNumber = buildTicketPresentation(ticket, counter).formattedNumber;

    emitToRoom('waiting-room', 'ticket-recalled', {
        ticketId: ticket._id,
        number: ticket.number,
        formattedNumber,
        customerName: ticket.name,
        counterId: counter._id,
        counterName: counter.name,
        serviceName: ticket.serviceId.name,
        recalledAt: new Date()
    });
};

const emitTicketProcessingRecalled = (ticket, counter) => {
    if (!hasIO()) {
        return;
    }

    const presentation = buildTicketPresentation(ticket, counter);

    emitToRoom('waiting-room', 'ticket-processing-recalled', {
        ticketId: ticket._id,
        number: ticket.number,
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber,
        customerName: ticket.name,
        counterId: counter._id,
        counterName: counter.name,
        serviceName: ticket.serviceId.name,
        recalledAt: new Date()
    });
};

const emitTicketRecallCancelled = (ticket) => {
    if (!hasIO()) {
        return;
    }

    const presentation = buildTicketPresentation(ticket);

    emitToRoom('waiting-room', 'ticket-recall-cancelled', {
        ticketId: ticket._id,
        number: ticket.number,
        formattedNumber: presentation.formattedNumber,
        displayNumber: presentation.displayNumber,
        customerName: ticket.name,
        serviceName: ticket.serviceId?.name,
        cancelledAt: new Date()
    });
};

const emitTicketCompleted = (ticket) => {
    if (!hasIO()) {
        return;
    }

    const formattedNumber = buildTicketPresentation(ticket).formattedNumber;

    emitToRoom('waiting-room', 'ticket-completed', {
        ticketId: ticket._id,
        number: ticket.number,
        formattedNumber,
        customerName: ticket.name,
        completedAt: new Date()
    });

    if (ticket.counterId) {
        emitToRoom(`counter-${ticket.counterId}`, 'ticket-finished', {
            ticketId: ticket._id,
            formattedNumber
        });
    }
};

const emitTicketSkipped = (ticket, currentCounterId) => {
    if (!hasIO()) {
        return;
    }

    const formattedNumber = buildTicketPresentation(ticket).formattedNumber;

    emitToRoom('waiting-room', 'ticket-skipped', {
        ticketId: ticket._id,
        number: ticket.number,
        formattedNumber,
        customerName: ticket.name,
        skipCount: ticket.skipCount,
        isRecall: ticket.isRecall,
        status: ticket.status,
        recalledAt: ticket.recalledAt
    });

    if (currentCounterId) {
        emitToRoom(`counter-${currentCounterId}`, 'ticket-skipped', {
            ticketId: ticket._id,
            formattedNumber
        });
    }
};

const emitTicketsResetDay = ({ date, deletedCount, lastIssuedByCounter, counterIds }) => {
    if (!hasIO()) {
        return;
    }

    emitToRoom('waiting-room', 'tickets-reset-day', {
        date,
        deletedCount,
        lastIssuedByCounter
    });

    (counterIds || []).forEach((counterId) => {
        emitToRoom(`counter-${counterId}`, 'counter-reset', {
            counterId,
            date
        });
    });
};

const emitTicketsResetAll = ({ deletedCount, lastIssuedByCounter }) => {
    if (!hasIO()) {
        return;
    }

    emitToRoom('waiting-room', 'tickets-reset-all', {
        deletedCount,
        lastIssuedByCounter
    });

    emitGlobal('tickets-reset-all', {
        deletedCount,
        lastIssuedByCounter
    });
};

module.exports = {
    emitStaffDisplayUpdateForCounters,
    emitTicketCalled,
    emitTicketCompleted,
    emitTicketProcessingRecalled,
    emitTicketRecallCancelled,
    emitTicketRecalled,
    emitTicketSkipped,
    emitTicketsResetAll,
    emitTicketsResetDay,
    emitWaitingRoomNewTicket
};
