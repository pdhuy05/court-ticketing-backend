const Ticket = require('../models/ticket.model');
const DailyStatistics = require('../models/dailyStatistics.model');
const { TicketStatus } = require('../constants/enums');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const average = (values) => {
  if (!values.length) {
    return 0;
  }
  const sum = values.reduce((acc, v) => acc + (Number(v) || 0), 0);
  return sum / values.length;
};

const formatLocalDateKey = (startDate) => [
  startDate.getFullYear(),
  String(startDate.getMonth() + 1).padStart(2, '0'),
  String(startDate.getDate()).padStart(2, '0')
].join('-');

/**
 * Tính và lưu thống kê theo ngày (upsert theo date YYYY-MM-DD).
 * @param {Date} startDate - đầu ngày (inclusive)
 * @param {Date} endDate - cuối ngày (exclusive, giống reset ticket)
 * @param {object|null} actor - user thực hiện reset
 */
const calculateDailyStatistics = async (startDate, endDate, actor = null) => {
  const date = formatLocalDateKey(startDate);

  const tickets = await Ticket.find({
    createdAt: { $gte: startDate, $lt: endDate }
  })
    .populate('serviceId', 'code name')
    .populate('counterId', 'name number')
    .populate('staffId', 'fullName username')
    .lean();

  const totalTickets = tickets.length;
  const completedTickets = tickets.filter((t) => t.status === TicketStatus.COMPLETED).length;
  const skippedTickets = tickets.filter((t) => t.status === TicketStatus.SKIPPED).length;

  const completionRate = totalTickets > 0 ? round2((completedTickets / totalTickets) * 100) : 0;
  const skipRate = totalTickets > 0 ? round2((skippedTickets / totalTickets) * 100) : 0;

  const avgWaitingTime = round2(average(tickets.map((t) => t.waitingDuration)));
  const avgProcessingTime = round2(average(tickets.map((t) => t.processingDuration)));

  const byServiceMap = new Map();
  for (const t of tickets) {
    const sid = String(t.serviceId?._id || t.serviceId || '');
    if (!sid) {
      continue;
    }
    if (!byServiceMap.has(sid)) {
      byServiceMap.set(sid, []);
    }
    byServiceMap.get(sid).push(t);
  }

  const byService = [];
  for (const [, list] of byServiceMap) {
    const svc = list[0].serviceId;
    const serviceId = svc?._id || list[0].serviceId;
    byService.push({
      serviceId,
      serviceCode: svc?.code || '',
      serviceName: svc?.name || '',
      total: list.length,
      completed: list.filter((x) => x.status === TicketStatus.COMPLETED).length,
      skipped: list.filter((x) => x.status === TicketStatus.SKIPPED).length,
      avgWaitingTime: round2(average(list.map((x) => x.waitingDuration))),
      avgProcessingTime: round2(average(list.map((x) => x.processingDuration)))
    });
  }
  byService.sort((a, b) => String(a.serviceCode).localeCompare(String(b.serviceCode)));

  const completedWithCounter = tickets.filter(
    (t) => t.status === TicketStatus.COMPLETED && (t.counterId?._id || t.counterId)
  );
  const byCounterMap = new Map();
  for (const t of completedWithCounter) {
    const c = t.counterId;
    const cid = String(c?._id || t.counterId);
    if (!byCounterMap.has(cid)) {
      byCounterMap.set(cid, []);
    }
    byCounterMap.get(cid).push(t);
  }

  const byCounter = [];
  for (const [, list] of byCounterMap) {
    const c = list[0].counterId;
    byCounter.push({
      counterId: c?._id || list[0].counterId,
      counterName: c?.name || '',
      counterNumber: typeof c?.number === 'number' ? c.number : 0,
      processedCount: list.length,
      avgProcessingTime: round2(average(list.map((x) => x.processingDuration)))
    });
  }
  byCounter.sort((a, b) => (a.counterNumber || 0) - (b.counterNumber || 0));

  const withStaff = tickets.filter((t) => t.staffId?._id || t.staffId);
  const byStaffMap = new Map();
  for (const t of withStaff) {
    const u = t.staffId;
    const uid = String(u?._id || t.staffId);
    if (!byStaffMap.has(uid)) {
      byStaffMap.set(uid, []);
    }
    byStaffMap.get(uid).push(t);
  }

  const byStaff = [];
  for (const [, list] of byStaffMap) {
    const u = list[0].staffId;
    const completedList = list.filter((x) => x.status === TicketStatus.COMPLETED);
    byStaff.push({
      staffId: u?._id || list[0].staffId,
      staffName: u?.fullName || '',
      username: u?.username || '',
      processedCount: completedList.length,
      avgProcessingTime: round2(average(completedList.map((x) => x.processingDuration))),
      skipCount: list.reduce((sum, x) => sum + (Number(x.skipCount) || 0), 0)
    });
  }
  byStaff.sort((a, b) => String(a.username).localeCompare(String(b.username)));

  const resetBy = actor
    ? {
        id: actor._id,
        username: actor.username || '',
        fullName: actor.fullName || ''
      }
    : null;

  const payload = {
    date,
    totalTickets,
    completedTickets,
    skippedTickets,
    completionRate,
    skipRate,
    avgWaitingTime,
    avgProcessingTime,
    byService,
    byCounter,
    byStaff,
    resetBy,
    resetAt: new Date()
  };

  const saved = await DailyStatistics.findOneAndUpdate(
    { date },
    { $set: payload },
    { upsert: true, new: true, runValidators: true }
  );

  return saved.toObject ? saved.toObject() : saved;
};

const getStatisticsByDate = async (date) => DailyStatistics.findOne({ date }).lean();

const getStatisticsByRange = async (startDate, endDate) => {
  const list = await DailyStatistics.find({
    date: { $gte: startDate, $lte: endDate }
  })
    .sort({ date: 1 })
    .lean();

  return list;
};

module.exports = {
  calculateDailyStatistics,
  getStatisticsByDate,
  getStatisticsByRange
};
