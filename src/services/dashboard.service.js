const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const Counter = require('../models/counter.model');
const User = require('../models/user.model');
const ServiceCounter = require('../models/serviceCounter.model');
const { TicketStatus } = require('../constants/enums');

const ADMIN_DASHBOARD_ROOM = 'admin-dashboard';
const ADMIN_DASHBOARD_EVENT = 'admin-dashboard:update';

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const getSummary = async () => {
  const { start, end } = getTodayRange();

  const [
    totalWaiting,
    totalProcessing,
    totalServices,
    activeServices,
    totalCounters,
    activeCounters,
    totalStaff,
    activeStaff,
    assignedStaff,
    ticketsIssuedToday,
    ticketsCompletedToday,
    ticketsSkippedToday,
    averageHandleResult
  ] = await Promise.all([
    Ticket.countDocuments({ status: TicketStatus.WAITING }),
    Ticket.countDocuments({ status: TicketStatus.PROCESSING }),
    Service.countDocuments(),
    Service.countDocuments({ isActive: true }),
    Counter.countDocuments(),
    Counter.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'staff' }),
    User.countDocuments({ role: 'staff', isActive: true }),
    User.countDocuments({ role: 'staff', counterId: { $ne: null } }),
    Ticket.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Ticket.countDocuments({
      status: TicketStatus.COMPLETED,
      completedAt: { $gte: start, $lt: end }
    }),
    Ticket.countDocuments({
      status: TicketStatus.SKIPPED,
      updatedAt: { $gte: start, $lt: end }
    }),
    Ticket.aggregate([
      {
        $match: {
          status: TicketStatus.COMPLETED,
          processingAt: { $ne: null },
          completedAt: { $gte: start, $lt: end }
        }
      },
      {
        $project: {
          durationInMinutes: {
            $divide: [
              { $subtract: ['$completedAt', '$processingAt'] },
              1000 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageHandleTimeInMinutes: { $avg: '$durationInMinutes' }
        }
      }
    ])
  ]);

  return {
    totalWaiting,
    totalProcessing,
    totalServices,
    activeServices,
    totalCounters,
    activeCounters,
    totalStaff,
    activeStaff,
    assignedStaff,
    unassignedStaff: Math.max(totalStaff - assignedStaff, 0),
    ticketsIssuedToday,
    ticketsCompletedToday,
    ticketsSkippedToday,
    averageHandleTimeInMinutes: Number(
      (averageHandleResult[0]?.averageHandleTimeInMinutes || 0).toFixed(1)
    )
  };
};

const getServiceStats = async () => {
  const services = await Service.find()
    .sort({ displayOrder: 1, createdAt: 1 })
    .select('code name isActive displayOrder');

  const stats = await Promise.all(
    services.map(async (service) => {
      const [waiting, processing, completedToday, counters] = await Promise.all([
        Ticket.countDocuments({
          serviceId: service._id,
          status: TicketStatus.WAITING
        }),
        Ticket.countDocuments({
          serviceId: service._id,
          status: TicketStatus.PROCESSING
        }),
        Ticket.countDocuments({
          serviceId: service._id,
          status: TicketStatus.COMPLETED,
          completedAt: { $gte: getTodayRange().start }
        }),
        ServiceCounter.countDocuments({
          serviceId: service._id,
          isActive: true
        })
      ]);

      return {
        id: service._id,
        code: service.code,
        name: service.name,
        isActive: service.isActive,
        displayOrder: service.displayOrder,
        counters,
        waiting,
        processing,
        completedToday
      };
    })
  );

  return stats;
};

const getCounterStats = async () => {
  const counters = await Counter.find()
    .sort({ number: 1, code: 1 })
    .select('code name number isActive processedCount currentTicketId');

  return Promise.all(
    counters.map(async (counter) => {
      const [currentTicket, serviceIds, staff] = await Promise.all([
        counter.currentTicketId
          ? Ticket.findById(counter.currentTicketId).select(
              'ticketNumber number name status serviceId'
            )
          : null,
        ServiceCounter.find({
          counterId: counter._id,
          isActive: true
        }).distinct('serviceId'),
        User.findOne({ role: 'staff', counterId: counter._id, isActive: true }).select(
          'fullName username'
        )
      ]);

      const waiting = serviceIds.length
        ? await Ticket.countDocuments({
            serviceId: { $in: serviceIds },
            status: TicketStatus.WAITING
          })
        : 0;

      return {
        id: counter._id,
        code: counter.code,
        name: counter.name,
        number: counter.number,
        isActive: counter.isActive,
        processedCount: counter.processedCount || 0,
        waiting,
        isServing: Boolean(currentTicket),
        currentTicket: currentTicket
          ? {
              id: currentTicket._id,
              number: currentTicket.number,
              ticketNumber: currentTicket.ticketNumber,
              customerName: currentTicket.name,
              status: currentTicket.status,
              serviceId: currentTicket.serviceId
            }
          : null,
        staff: staff
          ? {
              id: staff._id,
              fullName: staff.fullName,
              username: staff.username
            }
          : null
      };
    })
  );
};

const getRecentTickets = async () => {
  const recentTickets = await Ticket.find()
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(10)
    .populate('serviceId', 'code name')
    .populate('counterId', 'code name number')
    .select('ticketNumber number name phone status createdAt updatedAt completedAt skipCount');

  return recentTickets.map((ticket) => ({
    id: ticket._id,
    number: ticket.number,
    ticketNumber: ticket.ticketNumber,
    customerName: ticket.name,
    phone: ticket.phone,
    status: ticket.status,
    skipCount: ticket.skipCount || 0,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    completedAt: ticket.completedAt,
    service: ticket.serviceId
      ? {
          id: ticket.serviceId._id,
          code: ticket.serviceId.code,
          name: ticket.serviceId.name
        }
      : null,
    counter: ticket.counterId
      ? {
          id: ticket.counterId._id,
          code: ticket.counterId.code,
          name: ticket.counterId.name,
          number: ticket.counterId.number
        }
      : null
  }));
};

const getOverview = async () => {
  const generatedAt = new Date();
  const [summary, services, counters, recentTickets] = await Promise.all([
    getSummary(),
    getServiceStats(),
    getCounterStats(),
    getRecentTickets()
  ]);

  return {
    generatedAt,
    summary,
    services,
    counters,
    recentTickets
  };
};

const emitDashboardUpdate = async (reason = 'updated') => {
  if (!global.io) {
    return null;
  }

  const data = await getOverview();

  global.io.to(ADMIN_DASHBOARD_ROOM).emit(ADMIN_DASHBOARD_EVENT, {
    reason,
    generatedAt: data.generatedAt,
    data
  });

  return data;
};

const emitDashboardUpdateSafe = async (reason = 'updated') => {
  try {
    await emitDashboardUpdate(reason);
  } catch (error) {
    console.error(`Không thể cập nhật dashboard realtime: ${error.message}`);
  }
};

module.exports = {
  ADMIN_DASHBOARD_ROOM,
  ADMIN_DASHBOARD_EVENT,
  getOverview,
  emitDashboardUpdate,
  emitDashboardUpdateSafe
};
