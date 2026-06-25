const mongoose = require("mongoose");
const { emitDashboardUpdateSafe } = require("./dashboard.service");
const User = require("../models/user.model");
const Ticket = require("../models/ticket.model");
const Service = require("../models/service.model");
const ServiceSchedule = require("../models/serviceSchedule.model");
const { TicketStatus, ShiftAction } = require("../constants/enums");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/Logger");

// ─── Staff helpers ────────────────────────────────────────────────────────────

const findStaffById = async (staffId) => {
  const staff = await User.findById(staffId);
  if (!staff || staff.role !== "staff") {
    throw new ApiError(404, "Không tìm thấy nhân viên");
  }
  return staff;
};

const countActiveTicketsForStaff = async (staffId, counterId) => {
  return Ticket.countDocuments({
    $or: [
      { queueCounterId: counterId, status: TicketStatus.WAITING },
      { counterId, status: TicketStatus.PROCESSING },
    ],
  });
};

const appendShiftLog = (staff, action, { reason = "", waitingTicketsCount = 0 } = {}) => {
  if (!Array.isArray(staff.shiftHistory)) staff.shiftHistory = [];
  staff.shiftHistory.push({ action, timestamp: new Date(), reason, waitingTicketsCount });
};

const updateShiftStatus = async (staff, action, { reason = "", waitingTicketsCount = 0 } = {}) => {
  const now = new Date();
  staff.onDuty = action === ShiftAction.START;
  if (action === ShiftAction.START) {
    staff.lastShiftStart = now;
  } else {
    staff.lastShiftEnd = now;
  }
  appendShiftLog(staff, action, { reason, waitingTicketsCount });
  await staff.save();
  await emitDashboardUpdateSafe("shift-updated");
  return { onDuty: staff.onDuty, lastShiftStart: staff.lastShiftStart, lastShiftEnd: staff.lastShiftEnd, waitingTicketsCount };
};

// ─── Schedule helpers ─────────────────────────────────────────────────────────

const normalizeScheduleServiceId = (serviceId) => {
  if (serviceId === "ALL") return "ALL";
  if (!mongoose.Types.ObjectId.isValid(String(serviceId))) {
    throw new ApiError(400, "serviceId không hợp lệ");
  }
  return new mongoose.Types.ObjectId(String(serviceId));
};

const isAllServicesSchedule = (serviceId) => String(serviceId) === "ALL";

const populateScheduleService = async (schedule) => {
  if (!schedule) return null;
  const obj = typeof schedule.toObject === "function" ? schedule.toObject() : { ...schedule };
  if (isAllServicesSchedule(obj.serviceId)) return obj;
  const service = await Service.findById(obj.serviceId)
    .select("code name isActive isOpen manualOverride")
    .lean();
  obj.serviceId = service || obj.serviceId;
  return obj;
};

const resolveSlots = (schedule) => {
  if (Array.isArray(schedule.slots) && schedule.slots.length > 0) {
    return schedule.slots;
  }
  if (schedule.openTime && schedule.closeTime) {
    return [{ openTime: schedule.openTime, closeTime: schedule.closeTime }];
  }
  return [];
};

const isTimeInSlots = (hhmm, slots) => {
  return slots.some(({ openTime, closeTime }) => hhmm >= openTime && hhmm < closeTime);
};

// ─── Core state update ────────────────────────────────────────────────────────

const updateServicesOpenState = async (serviceId, isOpen, { skipOverride = false } = {}) => {
  if (isAllServicesSchedule(serviceId)) {
    // When auto-schedule runs, skip services that have a manualOverride set
    const filter = skipOverride ? { manualOverride: null } : {};
    const result = await Service.updateMany(filter, { $set: { isOpen } });
    await emitDashboardUpdateSafe("service-schedule-updated");
    return {
      serviceId: "ALL",
      isOpen,
      matchedCount: result.matchedCount ?? result.modifiedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
    };
  }

  const service = await Service.findByIdAndUpdate(
    serviceId,
    { $set: { isOpen } },
    { returnDocument: "after", runValidators: true },
  )
    .select("code name isActive isOpen manualOverride")
    .lean();

  if (!service) throw new ApiError(404, "Không tìm thấy quầy");
  await emitDashboardUpdateSafe("service-schedule-updated");
  return { serviceId: service._id, service, isOpen: service.isOpen, matchedCount: 1, modifiedCount: 1 };
};

// ─── Staff auto-start ─────────────────────────────────────────────────────────

const autoStartAllShifts = async () => {
  const offDutyStaff = await User.find({ role: "staff", isActive: true, onDuty: false });
  if (offDutyStaff.length === 0) return { startedCount: 0 };
  for (const staff of offDutyStaff) {
    await updateShiftStatus(staff, ShiftAction.START, { reason: "Tự động mở ca theo lịch" });
  }
  return { startedCount: offDutyStaff.length };
};

const getStaffByShiftStatus = async (onDuty = null) => {
  const query = { role: "staff", isActive: true };
  if (onDuty !== null) query.onDuty = onDuty;
  return User.find(query)
    .select("fullName username counterId onDuty lastShiftStart lastShiftEnd")
    .populate("counterId", "name number")
    .lean();
};

// ─── Schedule CRUD ────────────────────────────────────────────────────────────

const getAllSchedules = async () => {
  const schedules = await ServiceSchedule.find().sort({ createdAt: -1, updatedAt: -1 }).lean();
  return Promise.all(schedules.map(populateScheduleService));
};

const getShiftHistoryByStaff = async (staffId, limit = 50) => {
  const staff = await User.findById(staffId)
    .select("fullName username shiftHistory onDuty lastShiftStart lastShiftEnd")
    .lean();
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân viên");
  const normalizedLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 50;
  const history = [...(staff.shiftHistory || [])]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, normalizedLimit);
  return {
    staffId, fullName: staff.fullName, username: staff.username,
    onDuty: staff.onDuty, lastShiftStart: staff.lastShiftStart, lastShiftEnd: staff.lastShiftEnd,
    history,
  };
};

const upsertSchedule = async ({ serviceId, slots, openTime, closeTime, isEnabled = true }) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);

  if (!isAllServicesSchedule(normalizedServiceId)) {
    const service = await Service.findById(normalizedServiceId).select("_id");
    if (!service) throw new ApiError(404, "Không tìm thấy quầy");
  }

  let resolvedSlots = [];
  if (Array.isArray(slots) && slots.length > 0) {
    resolvedSlots = slots;
  } else if (openTime && closeTime) {
    resolvedSlots = [{ openTime, closeTime }];
  }

  if (resolvedSlots.length === 0) {
    throw new ApiError(400, "Cần ít nhất 1 ca (slot) thời gian");
  }

  for (const slot of resolvedSlots) {
    if (!slot.openTime || !slot.closeTime || slot.openTime >= slot.closeTime) {
      throw new ApiError(400, `Giờ mở phải trước giờ đóng (${slot.openTime} - ${slot.closeTime})`);
    }
  }

  const schedule = await ServiceSchedule.findOneAndUpdate(
    { serviceId: normalizedServiceId },
    {
      $set: {
        serviceId: normalizedServiceId,
        slots: resolvedSlots,
        openTime: resolvedSlots[0].openTime,
        closeTime: resolvedSlots[resolvedSlots.length - 1].closeTime,
        isEnabled: Boolean(isEnabled),
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();

  await applyScheduleDocNow(schedule);

  return populateScheduleService(schedule);
};

const deleteSchedule = async (serviceId) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);
  const result = await ServiceSchedule.deleteOne({ serviceId: normalizedServiceId });
  return { serviceId: normalizedServiceId, deletedCount: result.deletedCount || 0 };
};

const setScheduleEnabled = async (serviceId, isEnabled) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);
  const schedule = await ServiceSchedule.findOneAndUpdate(
    { serviceId: normalizedServiceId },
    { $set: { isEnabled: Boolean(isEnabled) } },
    { returnDocument: "after", runValidators: true },
  ).lean();

  if (!schedule) throw new ApiError(404, "Không tìm thấy lịch quầy");

  await applyScheduleDocNow(schedule);

  return populateScheduleService(schedule);
};

// ─── Apply schedule immediately ───────────────────────────────────────────────

const applyScheduleDocNow = async (scheduleDoc) => {
  if (!scheduleDoc || !scheduleDoc.isEnabled) return;
  const slots = resolveSlots(scheduleDoc);
  if (slots.length === 0) return;

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const isOpen = isTimeInSlots(hhmm, slots);
  const normalizedServiceId = normalizeScheduleServiceId(scheduleDoc.serviceId);
  await updateServicesOpenState(normalizedServiceId, isOpen, { skipOverride: true });
};

// ─── Cron job (runs every minute) ────────────────────────────────────────────

const runServiceScheduler = async () => {
  const schedules = await ServiceSchedule.find({ isEnabled: true }).lean();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const results = [];
  const allSchedule = schedules.find((s) => isAllServicesSchedule(s.serviceId));
  const perServiceSchedules = schedules.filter((s) => !isAllServicesSchedule(s.serviceId));
  const orderedSchedules = allSchedule ? [allSchedule, ...perServiceSchedules] : perServiceSchedules;

  for (const schedule of orderedSchedules) {
    const normalizedServiceId = normalizeScheduleServiceId(schedule.serviceId);
    const slots = resolveSlots(schedule);
    if (slots.length === 0) continue;

    const isOpen = isTimeInSlots(hhmm, slots);
    results.push(await updateServicesOpenState(normalizedServiceId, isOpen, { skipOverride: true }));
  }

  return { runAt: now.toISOString(), processedCount: schedules.length, updatedCount: results.length, results };
};

// ─── Startup: restore correct state ──────────────────────────────────────────

const applyCurrentScheduleState = async () => {
  const result = await runServiceScheduler();
  logger.info(`Đã khôi phục trạng thái isOpen cho ${result.processedCount} lịch quầy`);
};

// ─── Manual override ──────────────────────────────────────────────────────────

const setManualOverride = async (serviceId, override) => {
  if (!["open", "closed"].includes(override)) {
    throw new ApiError(400, "override phải là 'open' hoặc 'closed'");
  }
  const isOpen = override === "open";

  if (serviceId === "ALL") {
    await Service.updateMany({}, { $set: { manualOverride: override, isOpen } });
    await emitDashboardUpdateSafe("service-schedule-updated");
    return { serviceId: "ALL", manualOverride: override, isOpen };
  }

  const normalizedId = normalizeScheduleServiceId(serviceId);
  const service = await Service.findByIdAndUpdate(
    normalizedId,
    { $set: { manualOverride: override, isOpen } },
    { returnDocument: "after", runValidators: true },
  ).select("_id code name isOpen manualOverride").lean();

  if (!service) throw new ApiError(404, "Không tìm thấy dịch vụ");
  await emitDashboardUpdateSafe("service-schedule-updated");
  return { serviceId: service._id, manualOverride: service.manualOverride, isOpen: service.isOpen };
};

const clearManualOverride = async (serviceId) => {
  if (serviceId === "ALL") {
    await Service.updateMany({}, { $set: { manualOverride: null } });
    await applyCurrentScheduleState();
    await emitDashboardUpdateSafe("service-schedule-updated");
    return { serviceId: "ALL", manualOverride: null };
  }

  const normalizedId = normalizeScheduleServiceId(serviceId);
  const service = await Service.findByIdAndUpdate(
    normalizedId,
    { $set: { manualOverride: null } },
    { returnDocument: "after", runValidators: true },
  ).select("_id code name isOpen manualOverride").lean();

  if (!service) throw new ApiError(404, "Không tìm thấy dịch vụ");

  const schedule = await ServiceSchedule.findOne({
    $or: [
      { serviceId: normalizedId },
      { serviceId: "ALL" },
    ],
  }).sort({ serviceId: -1 }).lean();

  if (schedule && schedule.isEnabled) {
    await applyScheduleDocNow({ ...schedule, serviceId: normalizedId });
  }

  await emitDashboardUpdateSafe("service-schedule-updated");
  return { serviceId: service._id, manualOverride: service.manualOverride, isOpen: service.isOpen };
};

// ─── Staff shift admin ────────────────────────────────────────────────────────

const adminStartShift = async (staffId) => {
  const staff = await findStaffById(staffId);
  if (staff.onDuty) throw new ApiError(400, "Nhân viên đang trong ca làm việc");
  const result = await updateShiftStatus(staff, ShiftAction.START, { reason: "Admin mở ca thủ công" });
  return { onDuty: result.onDuty, lastShiftStart: result.lastShiftStart };
};

const adminEndShift = async (staffId, { reason = "Admin kết thúc ca thủ công" } = {}) => {
  const staff = await findStaffById(staffId);
  if (!staff.onDuty) throw new ApiError(400, "Nhân viên không đang trong ca làm việc");
  const waitingTicketsCount = staff.counterId
    ? await countActiveTicketsForStaff(staffId, staff.counterId) : 0;
  const result = await updateShiftStatus(staff, ShiftAction.END, { reason, waitingTicketsCount });
  return { onDuty: result.onDuty, lastShiftEnd: result.lastShiftEnd, waitingTicketsCount };
};

module.exports = {
  appendShiftLog,
  applyCurrentScheduleState,
  autoStartAllShifts,
  clearManualOverride,
  countActiveTicketsForStaff,
  deleteSchedule,
  findStaffById,
  getAllSchedules,
  getStaffByShiftStatus,
  getShiftHistoryByStaff,
  adminStartShift,
  adminEndShift,
  runServiceScheduler,
  setManualOverride,
  setScheduleEnabled,
  updateShiftStatus,
  upsertSchedule,
};