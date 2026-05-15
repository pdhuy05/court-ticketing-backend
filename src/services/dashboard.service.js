const Ticket = require("../models/ticket.model");
const Service = require("../models/service.model");
const Counter = require("../models/counter.model");
const User = require("../models/user.model");
const ServiceCounter = require("../models/serviceCounter.model");
const { TicketStatus } = require("../constants/enums");
const { emitToRoom, hasIO } = require("../utils/socketEmitter");

const ADMIN_DASHBOARD_ROOM = "admin-dashboard";
const ADMIN_DASHBOARD_EVENT = "admin-dashboard:update";
const DEFAULT_OVERLOAD_THRESHOLD = 10;

const getDayRange = (targetDate = new Date()) => {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const getMonthRange = (targetDate = new Date()) => {
  const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

  return { start, end };
};

const parseDailyDate = (date) => {
  if (!date) {
    return new Date();
  }

  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const parseMonthlyDate = (month) => {
  if (!month) {
    return new Date();
  }

  const [year, monthValue] = month.split("-").map(Number);
  return new Date(year, monthValue - 1, 1);
};

const formatDayKey = (date) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatMonthKey = (date) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
};

const getSummary = async (range) => {
  const { start, end } = range;

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
    averageHandleResult,
  ] = await Promise.all([
    Ticket.countDocuments({ status: TicketStatus.WAITING }),
    Ticket.countDocuments({ status: TicketStatus.PROCESSING }),
    Service.countDocuments(),
    Service.countDocuments({ isActive: true }),
    Counter.countDocuments(),
    Counter.countDocuments({ isActive: true }),
    User.countDocuments({ role: "staff" }),
    User.countDocuments({ role: "staff", isActive: true }),
    User.countDocuments({ role: "staff", counterId: { $ne: null } }),
    Ticket.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Ticket.countDocuments({
      status: TicketStatus.COMPLETED,
      completedAt: { $gte: start, $lt: end },
    }),
    Ticket.countDocuments({
      status: TicketStatus.SKIPPED,
      skippedAt: { $gte: start, $lt: end },
    }),
    Ticket.aggregate([
      {
        $match: {
          status: TicketStatus.COMPLETED,
          processingAt: { $ne: null },
          completedAt: { $gte: start, $lt: end },
        },
      },
      {
        $project: {
          durationInMinutes: {
            $divide: [
              { $subtract: ["$completedAt", "$processingAt"] },
              1000 * 60,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageHandleTimeInMinutes: { $avg: "$durationInMinutes" },
        },
      },
    ]),
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
      (averageHandleResult[0]?.averageHandleTimeInMinutes || 0).toFixed(1),
    ),
  };
};

const getServiceStats = async () => {
  const services = await Service.find()
    .sort({ displayOrder: 1, createdAt: 1 })
    .select("code name isActive displayOrder");

  const stats = await Promise.all(
    services.map(async (service) => {
      const [waiting, processing, completedToday, counters] = await Promise.all(
        [
          Ticket.countDocuments({
            serviceId: service._id,
            status: TicketStatus.WAITING,
          }),
          Ticket.countDocuments({
            serviceId: service._id,
            status: TicketStatus.PROCESSING,
          }),
          Ticket.countDocuments({
            serviceId: service._id,
            status: TicketStatus.COMPLETED,
            completedAt: { $gte: getDayRange().start },
          }),
          ServiceCounter.countDocuments({
            serviceId: service._id,
            isActive: true,
          }),
        ],
      );

      return {
        id: service._id,
        code: service.code,
        name: service.name,
        isActive: service.isActive,
        displayOrder: service.displayOrder,
        counters,
        waiting,
        processing,
        completedToday,
      };
    }),
  );

  return stats;
};

const getCounterStats = async (
  overloadThreshold = DEFAULT_OVERLOAD_THRESHOLD,
) => {
  const counters = await Counter.find()
    .sort({ number: 1, code: 1 })
    .select("code name number isActive processedCount currentTicketId");

  return Promise.all(
    counters.map(async (counter) => {
      const [currentTicket, serviceIds, staff] = await Promise.all([
        counter.currentTicketId
          ? Ticket.findById(counter.currentTicketId).select(
              "ticketNumber number name status serviceId",
            )
          : null,
        ServiceCounter.find({
          counterId: counter._id,
          isActive: true,
        }).distinct("serviceId"),
        User.findOne({
          role: "staff",
          counterId: counter._id,
          isActive: true,
        }).select("fullName username"),
      ]);

      const waiting = serviceIds.length
        ? await Ticket.countDocuments({
            serviceId: { $in: serviceIds },
            status: TicketStatus.WAITING,
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
        overloadThreshold,
        isOverloaded: waiting >= overloadThreshold,
        overloadLevel:
          waiting >= overloadThreshold * 2
            ? "critical"
            : waiting >= overloadThreshold
              ? "warning"
              : "normal",
        isServing: Boolean(currentTicket),
        currentTicket: currentTicket
          ? {
              id: currentTicket._id,
              number: currentTicket.number,
              ticketNumber: currentTicket.ticketNumber,
              customerName: currentTicket.name,
              status: currentTicket.status,
              serviceId: currentTicket.serviceId,
            }
          : null,
        staff: staff
          ? {
              id: staff._id,
              fullName: staff.fullName,
              username: staff.username,
            }
          : null,
      };
    }),
  );
};

const getOverloadAlerts = (counters, overloadThreshold) => {
  return counters
    .filter((counter) => counter.isOverloaded)
    .sort((a, b) => b.waiting - a.waiting)
    .map((counter) => ({
      type: "counter-overload",
      level: counter.overloadLevel,
      counterId: counter.id,
      counterCode: counter.code,
      counterName: counter.name,
      counterNumber: counter.number,
      waiting: counter.waiting,
      threshold: overloadThreshold,
      message: `Phòng ${counter.name} đang quá tải với ${counter.waiting} ticket chờ`,
    }));
};

const getLatestTicketsForOverview = async () => {
  const recentTickets = await Ticket.find()
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(10)
    .populate("serviceId", "code name")
    .populate("counterId", "code name number")
    .select(
      "ticketNumber number name phone status createdAt updatedAt completedAt skipCount",
    );

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
          name: ticket.serviceId.name,
        }
      : null,
    counter: ticket.counterId
      ? {
          id: ticket.counterId._id,
          code: ticket.counterId.code,
          name: ticket.counterId.name,
          number: ticket.counterId.number,
        }
      : null,
  }));
};

const getOverview = async (options = {}) => {
  const generatedAt = new Date();
  const overloadThreshold =
    Number(options.overloadThreshold) || DEFAULT_OVERLOAD_THRESHOLD;
  const [summary, services, counters, recentTickets] = await Promise.all([
    getSummary(getDayRange()),
    getServiceStats(),
    getCounterStats(overloadThreshold),
    getLatestTicketsForOverview(),
  ]);
  const alerts = getOverloadAlerts(counters, overloadThreshold);

  return {
    generatedAt,
    summary: {
      ...summary,
      overloadedCounters: alerts.length,
      overloadThreshold,
    },
    alerts,
    services,
    counters,
    recentTickets,
  };
};

const getReportRange = ({ period = "daily", date, month }) => {
  if (period === "monthly") {
    const targetDate = parseMonthlyDate(month);
    return {
      period,
      label: formatMonthKey(targetDate),
      ...getMonthRange(targetDate),
    };
  }

  const targetDate = parseDailyDate(date);
  return {
    period,
    label: formatDayKey(targetDate),
    ...getDayRange(targetDate),
  };
};

const getReportSummary = async (range) => {
  const { start, end } = range;

  const [issued, waiting, processing, completed, skipped, averageHandleResult] =
    await Promise.all([
      Ticket.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Ticket.countDocuments({
        createdAt: { $gte: start, $lt: end },
        status: TicketStatus.WAITING,
      }),
      Ticket.countDocuments({
        createdAt: { $gte: start, $lt: end },
        status: TicketStatus.PROCESSING,
      }),
      Ticket.countDocuments({
        completedAt: { $gte: start, $lt: end },
        status: TicketStatus.COMPLETED,
      }),
      Ticket.countDocuments({
        skippedAt: { $gte: start, $lt: end },
        status: TicketStatus.SKIPPED,
      }),
      Ticket.aggregate([
        {
          $match: {
            status: TicketStatus.COMPLETED,
            processingAt: { $ne: null },
            completedAt: { $gte: start, $lt: end },
          },
        },
        {
          $project: {
            durationInMinutes: {
              $divide: [
                { $subtract: ["$completedAt", "$processingAt"] },
                1000 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageHandleTimeInMinutes: { $avg: "$durationInMinutes" },
          },
        },
      ]),
    ]);

  return {
    issued,
    waiting,
    processing,
    completed,
    skipped,
    averageHandleTimeInMinutes: Number(
      (averageHandleResult[0]?.averageHandleTimeInMinutes || 0).toFixed(1),
    ),
  };
};

const getServiceReport = async (range) => {
  const { start, end } = range;
  const services = await Service.find()
    .sort({ displayOrder: 1, createdAt: 1 })
    .select("code name isActive displayOrder");

  return Promise.all(
    services.map(async (service) => {
      const [issued, completed, skipped, waitingNow] = await Promise.all([
        Ticket.countDocuments({
          serviceId: service._id,
          createdAt: { $gte: start, $lt: end },
        }),
        Ticket.countDocuments({
          serviceId: service._id,
          status: TicketStatus.COMPLETED,
          completedAt: { $gte: start, $lt: end },
        }),
        Ticket.countDocuments({
          serviceId: service._id,
          status: TicketStatus.SKIPPED,
          skippedAt: { $gte: start, $lt: end },
        }),
        Ticket.countDocuments({
          serviceId: service._id,
          status: TicketStatus.WAITING,
        }),
      ]);

      return {
        id: service._id,
        code: service.code,
        name: service.name,
        isActive: service.isActive,
        displayOrder: service.displayOrder,
        issued,
        completed,
        skipped,
        waitingNow,
      };
    }),
  );
};

const getCounterReport = async (
  range,
  overloadThreshold = DEFAULT_OVERLOAD_THRESHOLD,
) => {
  const { start, end } = range;
  const counters = await Counter.find()
    .sort({ number: 1, code: 1 })
    .select("code name number isActive processedCount");

  return Promise.all(
    counters.map(async (counter) => {
      const serviceIds = await ServiceCounter.find({
        counterId: counter._id,
        isActive: true,
      }).distinct("serviceId");

      const [served, completed, skipped, waitingNow] = await Promise.all([
        Ticket.countDocuments({
          counterId: counter._id,
          processingAt: { $gte: start, $lt: end },
        }),
        Ticket.countDocuments({
          counterId: counter._id,
          status: TicketStatus.COMPLETED,
          completedAt: { $gte: start, $lt: end },
        }),
        Ticket.countDocuments({
          counterId: counter._id,
          status: TicketStatus.SKIPPED,
          skippedAt: { $gte: start, $lt: end },
        }),
        serviceIds.length
          ? Ticket.countDocuments({
              serviceId: { $in: serviceIds },
              status: TicketStatus.WAITING,
            })
          : 0,
      ]);

      return {
        id: counter._id,
        code: counter.code,
        name: counter.name,
        number: counter.number,
        isActive: counter.isActive,
        processedCount: counter.processedCount || 0,
        served,
        completed,
        skipped,
        waitingNow,
        isOverloaded: waitingNow >= overloadThreshold,
      };
    }),
  );
};

const getTimelineReport = async (range) => {
  const { start, end, period } = range;
  const timeline = [];

  if (period === "monthly") {
    for (let day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
      const currentStart = new Date(day);
      const currentEnd = new Date(day);
      currentEnd.setDate(currentEnd.getDate() + 1);

      const [issued, completed] = await Promise.all([
        Ticket.countDocuments({
          createdAt: { $gte: currentStart, $lt: currentEnd },
        }),
        Ticket.countDocuments({
          status: TicketStatus.COMPLETED,
          completedAt: { $gte: currentStart, $lt: currentEnd },
        }),
      ]);

      timeline.push({
        label: formatDayKey(currentStart),
        issued,
        completed,
      });
    }

    return timeline;
  }

  for (let hour = 0; hour < 24; hour += 1) {
    const currentStart = new Date(start);
    currentStart.setHours(hour, 0, 0, 0);
    const currentEnd = new Date(currentStart);
    currentEnd.setHours(hour + 1, 0, 0, 0);

    const [issued, completed] = await Promise.all([
      Ticket.countDocuments({
        createdAt: { $gte: currentStart, $lt: currentEnd },
      }),
      Ticket.countDocuments({
        status: TicketStatus.COMPLETED,
        completedAt: { $gte: currentStart, $lt: currentEnd },
      }),
    ]);

    timeline.push({
      label: `${String(hour).padStart(2, "0")}:00`,
      issued,
      completed,
    });
  }

  return timeline;
};

const getReport = async (options = {}) => {
  const range = getReportRange(options);
  const overloadThreshold =
    Number(options.overloadThreshold) || DEFAULT_OVERLOAD_THRESHOLD;

  const [summary, services, counters, timeline] = await Promise.all([
    getReportSummary(range),
    getServiceReport(range),
    getCounterReport(range, overloadThreshold),
    getTimelineReport(range),
  ]);

  return {
    generatedAt: new Date(),
    period: range.period,
    label: range.label,
    range: {
      start: range.start,
      end: range.end,
    },
    summary,
    services,
    counters,
    timeline,
  };
};

const emitDashboardUpdate = async (reason = "updated") => {
  if (!hasIO()) {
    return null;
  }

  const data = await getOverview();

  emitToRoom(ADMIN_DASHBOARD_ROOM, ADMIN_DASHBOARD_EVENT, {
    reason,
    generatedAt: data.generatedAt,
    data,
  });

  return data;
};

const emitDashboardUpdateSafe = async (reason = "updated") => {
  try {
    await emitDashboardUpdate(reason);
  } catch (error) {
    console.error(`Không thể cập nhật dashboard realtime: ${error.message}`);
  }
};

const getTicketsOverview = async () => {
  const [totalTickets, statusCounts, serviceCounts] = await Promise.all([
    Ticket.countDocuments(),
    Ticket.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Ticket.aggregate([
      {
        $group: {
          _id: "$serviceId",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "_id",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $unwind: "$service",
      },
      {
        $project: {
          serviceId: "$_id",
          serviceName: "$service.name",
          count: 1,
        },
      },
    ]),
  ]);

  const statusMap = {};
  statusCounts.forEach((item) => {
    statusMap[item._id] = item.count;
  });

  return {
    totalTickets,
    statusCounts: {
      waiting: statusMap[TicketStatus.WAITING] || 0,
      processing: statusMap[TicketStatus.PROCESSING] || 0,
      completed: statusMap[TicketStatus.COMPLETED] || 0,
      skipped: statusMap[TicketStatus.SKIPPED] || 0,
    },
    serviceCounts,
  };
};

const getCountersStatus = async () => {
  const [totalCounters, activeCounters, countersList] = await Promise.all([
    Counter.countDocuments(),
    Counter.countDocuments({ isActive: true }),
    Counter.find().select("code name number isActive").sort({ number: 1 }),
  ]);

  return {
    totalCounters,
    activeCounters,
    inactiveCounters: totalCounters - activeCounters,
    countersList,
  };
};

const getStaffList = async () => {
  const [totalStaff, staffList] = await Promise.all([
    User.countDocuments({ role: "staff", isActive: true }),
    User.find({ role: "staff" })
      .populate("counterId", "name number isActive")
      .select("fullName username isActive onDuty counterId")
      .sort({ isActive: -1, fullName: 1 }),
  ]);

  const onDutyStaff = staffList.filter((staff) => staff.onDuty && staff.isActive);
  const offDutyStaff = staffList.filter((staff) => !staff.onDuty || !staff.isActive);

  return {
    totalStaff,
    onDutyStaff,
    offDutyStaff,
    staffList,
  };
};

const getTicketsToday = async () => {
  const today = new Date().toISOString().split("T")[0]; 
  const [totalToday, statusCounts] = await Promise.all([
    Ticket.countDocuments({ date: today }),
    Ticket.aggregate([
      {
        $match: { date: today },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statusMap = {};
  statusCounts.forEach((item) => {
    statusMap[item._id] = item.count;
  });

  const completed = statusMap[TicketStatus.COMPLETED] || 0;
  const skipped = statusMap[TicketStatus.SKIPPED] || 0;
  const waiting = statusMap[TicketStatus.WAITING] || 0;
  const processing = statusMap[TicketStatus.PROCESSING] || 0;

  return {
    totalToday,
    statusCounts: {
      completed,
      skipped,
      waiting,
      processing,
    },
    percentages: {
      completed:
        totalToday > 0 ? Math.round((completed / totalToday) * 100) : 0,
      skipped: totalToday > 0 ? Math.round((skipped / totalToday) * 100) : 0,
      waiting: totalToday > 0 ? Math.round((waiting / totalToday) * 100) : 0,
      processing:
        totalToday > 0 ? Math.round((processing / totalToday) * 100) : 0,
    },
  };
};

const getRecentTickets = async () => {
  const counters = await Counter.find({ isActive: true }).select("_id");

  const recentByCounter = await Promise.all(
    counters.map(async (counter) => {
      const tickets = await Ticket.find({ counterId: counter._id })
        .populate("serviceId", "name code")
        .populate("staffId", "fullName username")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("number ticketNumber status createdAt");

      return {
        counterId: counter._id,
        tickets,
      };
    }),
  );

  const services = await Service.find({ isActive: true }).select("_id");

  const recentByService = await Promise.all(
    services.map(async (service) => {
      const tickets = await Ticket.find({ serviceId: service._id })
        .populate("counterId", "name number")
        .populate("staffId", "fullName username")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("number ticketNumber status createdAt");

      return {
        serviceId: service._id,
        tickets,
      };
    }),
  );

  return {
    recentByCounter,
    recentByService,
  };
};

const getTicketRatio = async () => {
  const counters = await Counter.find().select("name number");

  const ratios = await Promise.all(
    counters.map(async (counter) => {
      // Tickets with COMPLETED or SKIPPED status have counterId set correctly
      const [completed, skipped] = await Promise.all([
        Ticket.countDocuments({
          counterId: counter._id,
          status: TicketStatus.COMPLETED,
        }),
        Ticket.countDocuments({
          counterId: counter._id,
          status: TicketStatus.SKIPPED,
        }),
      ]);

      // Waiting tickets are NOT yet assigned a counterId — query via the
      // services linked to this counter through ServiceCounter instead
      const serviceIds = await ServiceCounter.find({
        counterId: counter._id,
        isActive: true,
      }).distinct("serviceId");

      const waiting = serviceIds.length
        ? await Ticket.countDocuments({
            serviceId: { $in: serviceIds },
            status: TicketStatus.WAITING,
          })
        : 0;

      const total = completed + skipped + waiting;

      return {
        counterId: counter._id,
        counterName: counter.name,
        total,
        completed,
        skipped,
        waiting,
        percentages: {
          completed: total > 0 ? Math.round((completed / total) * 100) : 0,
          skipped: total > 0 ? Math.round((skipped / total) * 100) : 0,
          waiting: total > 0 ? Math.round((waiting / total) * 100) : 0,
        },
      };
    }),
  );

  return ratios;
};

const getTicketTrend = async (groupBy = "day") => {
  let pipeline = [];
  let limit = 30;

  if (groupBy === "month") {
    pipeline = [
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.COMPLETED] }, 1, 0],
            },
          },
          skipped: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.SKIPPED] }, 1, 0],
            },
          },
          waiting: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.WAITING] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 },
      },
      {
        $limit: 12,
      },
    ];
    limit = 12;
  } else if (groupBy === "year") {
    pipeline = [
      {
        $group: {
          _id: { year: { $year: "$createdAt" } },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.COMPLETED] }, 1, 0],
            },
          },
          skipped: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.SKIPPED] }, 1, 0],
            },
          },
          waiting: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.WAITING] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": -1 },
      },
      {
        $limit: 5,
      },
    ];
    limit = 5;
  } else {
    pipeline = [
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.COMPLETED] }, 1, 0],
            },
          },
          skipped: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.SKIPPED] }, 1, 0],
            },
          },
          waiting: {
            $sum: {
              $cond: [{ $eq: ["$status", TicketStatus.WAITING] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 },
      },
      {
        $limit: 30,
      },
    ];
  }

  const results = await Ticket.aggregate(pipeline);

  const trend = results.map((item) => {
    let label = "";
    if (groupBy === "month") {
      label = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
    } else if (groupBy === "year") {
      label = `${item._id.year}`;
    } else {
      label = `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`;
    }

    return {
      label,
      completed: item.completed,
      skipped: item.skipped,
      waiting: item.waiting,
      total: item.total,
    };
  });

  return trend.reverse();
};

const getCounterAlerts = async () => {
  const counters = await Counter.find({ isActive: true }).select("name number");

  const alerts = await Promise.all(
    counters.map(async (counter) => {
      const serviceIds = await ServiceCounter.find({
        counterId: counter._id,
        isActive: true,
      }).distinct("serviceId");

      const waitingCount = await Ticket.countDocuments({
        serviceId: { $in: serviceIds },
        status: TicketStatus.WAITING,
      });

      return {
        counterId: counter._id,
        counterName: counter.name,
        waitingCount,
        isAlert: waitingCount >= 50,
      };
    }),
  );

  return alerts.filter((alert) => alert.isAlert);
};

const emitTicketsOverview = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:ticketOverview", data);
  }
};

const emitCountersStatus = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:counterStatus", data);
  }
};

const emitStaffList = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:staffList", data);
  }
};

const emitTicketsToday = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:ticketsToday", data);
  }
};

const emitRecentTickets = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:recentTickets", data);
  }
};

const emitTicketRatio = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:ticketRatio", data);
  }
};

const emitTicketTrend = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:ticketTrend", data);
  }
};

const emitCounterAlerts = (data) => {
  if (hasIO()) {
    emitToRoom(ADMIN_DASHBOARD_ROOM, "dashboard:counterAlert", data);
  }
};

const getCounterCompletedTotal = async (date = null) => {
  const match = { 
    status: TicketStatus.COMPLETED, 
    counterId: { $ne: null } 
  };

  if (date) {
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    match.completedAt = { $gte: start, $lt: end };
  }

  const results = await Ticket.aggregate([
    { $match: match },
    { $group: { _id: "$counterId", totalCompleted: { $sum: 1 } } }
  ]);

  const counters = await Counter.find({ isActive: true })
    .select("name number code")
    .sort({ number: 1 })
    .lean();

  const totalMap = new Map(
    results.map((r) => [String(r._id), r.totalCompleted])
  );

  return counters.map((counter) => ({
    counterId: counter._id,
    counterName: counter.name,
    counterNumber: counter.number,
    counterCode: counter.code,
    totalCompleted: totalMap.get(String(counter._id)) || 0,
  }));
};

module.exports = {
  ADMIN_DASHBOARD_ROOM,
  ADMIN_DASHBOARD_EVENT,
  DEFAULT_OVERLOAD_THRESHOLD,
  getOverview,
  getReport,
  emitDashboardUpdate,
  emitDashboardUpdateSafe,
  getTicketsOverview,
  getCountersStatus,
  getStaffList,
  getTicketsToday,
  getRecentTickets,
  getTicketRatio,
  getTicketTrend,
  getCounterAlerts,
  emitTicketsOverview,
  emitCountersStatus,
  emitStaffList,
  emitTicketsToday,
  emitRecentTickets,
  emitTicketRatio,
  emitTicketTrend,
  emitCounterAlerts,
  getCounterCompletedTotal,
};