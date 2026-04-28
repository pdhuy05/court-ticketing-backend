const mongoose = require('mongoose');
const { emitDashboardUpdateSafe } = require('./dashboard.service');
const User = require('../models/user.model');
const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const ServiceSchedule = require('../models/serviceSchedule.model');
const { TicketStatus, ShiftAction } = require('../constants/enums');
const ApiError = require('../utils/ApiError');

const findStaffById = async (staffId) => {
  const staff = await User.findById(staffId);

  if (!staff || staff.role !== 'staff') {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  return staff;
};

const countActiveTicketsForStaff = async (staffId, counterId) => {
  return Ticket.countDocuments({
    $or: [
      {
        queueCounterId: counterId,
        status: TicketStatus.WAITING
      },
      {
        counterId,
        status: TicketStatus.PROCESSING
      }
    ]
  });
};

const appendShiftLog = (staff, action, { reason = '', waitingTicketsCount = 0 } = {}) => {
  if (!Array.isArray(staff.shiftHistory)) {
    staff.shiftHistory = [];
  }

  staff.shiftHistory.push({
    action,
    timestamp: new Date(),
    reason,
    waitingTicketsCount
  });
};

const updateShiftStatus = async (staff, action, { reason = '', waitingTicketsCount = 0 } = {}) => {
  const now = new Date();

  staff.onDuty = action === ShiftAction.START;

  if (action === ShiftAction.START) {
    staff.lastShiftStart = now;
  } else {
    staff.lastShiftEnd = now;
  }

  appendShiftLog(staff, action, { reason, waitingTicketsCount });
  
  await staff.save();

  await emitDashboardUpdateSafe('shift-updated');

  return {
    onDuty: staff.onDuty,
    lastShiftStart: staff.lastShiftStart,
    lastShiftEnd: staff.lastShiftEnd,
    waitingTicketsCount
  };
};

const normalizeScheduleServiceId = (serviceId) => {
  if (serviceId === 'ALL') {
    return 'ALL';
  }

  if (!mongoose.Types.ObjectId.isValid(String(serviceId))) {
    throw new ApiError(400, 'serviceId không hợp lệ');
  }

  return new mongoose.Types.ObjectId(String(serviceId));
};

const isAllServicesSchedule = (serviceId) => String(serviceId) === 'ALL';

const populateScheduleService = async (schedule) => {
  if (!schedule) {
    return null;
  }

  const scheduleObject = typeof schedule.toObject === 'function'
    ? schedule.toObject()
    : { ...schedule };

  if (isAllServicesSchedule(scheduleObject.serviceId)) {
    return scheduleObject;
  }

  const service = await Service.findById(scheduleObject.serviceId)
    .select('code name isActive isOpen')
    .lean();

  scheduleObject.serviceId = service || scheduleObject.serviceId;

  return scheduleObject;
};

const updateServicesOpenState = async (serviceId, isOpen) => {
  if (isAllServicesSchedule(serviceId)) {
    const result = await Service.updateMany({}, { $set: { isOpen } });

    await emitDashboardUpdateSafe('service-schedule-updated');

    return {
      serviceId: 'ALL',
      isOpen,
      matchedCount: result.matchedCount ?? result.modifiedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0
    };
  }

  const service = await Service.findByIdAndUpdate(
    serviceId,
    { $set: { isOpen } },
    { returnDocument: 'after', runValidators: true }
  )
    .select('code name isActive isOpen')
    .lean();

  if (!service) {
    throw new ApiError(404, 'Không tìm thấy dịch vụ');
  }

  await emitDashboardUpdateSafe('service-schedule-updated');

  return {
    serviceId: service._id,
    service,
    isOpen: service.isOpen,
    matchedCount: 1,
    modifiedCount: 1
  };
};

const autoStartAllShifts = async () => {
  const offDutyStaff = await User.find({
    role: 'staff',
    isActive: true,
    onDuty: false
  });

  if (offDutyStaff.length === 0) {
    return { startedCount: 0 };
  }

  for (const staff of offDutyStaff) {
    await updateShiftStatus(staff, ShiftAction.START, {
      reason: 'Tự động mở ca theo lịch'
    });
  }

  return { startedCount: offDutyStaff.length };
};

const getStaffByShiftStatus = async (onDuty = null) => {
  const query = { role: 'staff', isActive: true };

  if (onDuty !== null) {
    query.onDuty = onDuty;
  }

  return User.find(query)
    .select('fullName username counterId onDuty lastShiftStart lastShiftEnd')
    .populate('counterId', 'name number')
    .lean();
};

const getAllSchedules = async () => {
  const schedules = await ServiceSchedule.find()
    .sort({ createdAt: -1, updatedAt: -1 })
    .lean();

  return Promise.all(schedules.map(populateScheduleService));
};

const getShiftHistoryByStaff = async (staffId, limit = 50) => {
  const staff = await User.findById(staffId)
    .select('fullName username shiftHistory onDuty lastShiftStart lastShiftEnd')
    .lean();

  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  const normalizedLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Number(limit)
    : 50;

  const history = [...(staff.shiftHistory || [])]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, normalizedLimit);

  return {
    staffId,
    fullName: staff.fullName,
    username: staff.username,
    onDuty: staff.onDuty,
    lastShiftStart: staff.lastShiftStart,
    lastShiftEnd: staff.lastShiftEnd,
    history
  };
};

const upsertSchedule = async ({ serviceId, openTime, closeTime, isEnabled = true }) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);

  if (!isAllServicesSchedule(normalizedServiceId)) {
    const service = await Service.findById(normalizedServiceId).select('_id');

    if (!service) {
      throw new ApiError(404, 'Không tìm thấy dịch vụ');
    }
  }

  const schedule = await ServiceSchedule.findOneAndUpdate(
    { serviceId: normalizedServiceId },
    {
      $set: {
        serviceId: normalizedServiceId,
        openTime,
        closeTime,
        isEnabled: Boolean(isEnabled)
      }
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true
    }
  ).lean();

  return populateScheduleService(schedule);
};

const deleteSchedule = async (serviceId) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);
  const result = await ServiceSchedule.deleteOne({ serviceId: normalizedServiceId });

  return {
    serviceId: normalizedServiceId,
    deletedCount: result.deletedCount || 0
  };
};

const setScheduleEnabled = async (serviceId, isEnabled) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);
  const schedule = await ServiceSchedule.findOneAndUpdate(
    { serviceId: normalizedServiceId },
    { $set: { isEnabled: Boolean(isEnabled) } },
    { returnDocument: 'after', runValidators: true }
  ).lean();

  if (!schedule) {
    throw new ApiError(404, 'Không tìm thấy lịch dịch vụ');
  }

  return populateScheduleService(schedule);
};

const applyScheduleNow = async (serviceId) => {
  const normalizedServiceId = normalizeScheduleServiceId(serviceId);
  const schedule = await ServiceSchedule.findOne({
    serviceId: normalizedServiceId
  }).lean();

  if (!schedule) {
    throw new ApiError(404, 'Không tìm thấy lịch dịch vụ');
  }

  if (!schedule.isEnabled) {
    return {
      serviceId: normalizedServiceId,
      skipped: true,
      reason: 'Schedule is disabled'
    };
  }

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (currentHHMM === schedule.openTime) {
    return updateServicesOpenState(normalizedServiceId, true);
  }

  if (currentHHMM === schedule.closeTime) {
    return updateServicesOpenState(normalizedServiceId, false);
  }

  return {
    serviceId: normalizedServiceId,
    skipped: true,
    reason: 'Current time does not match schedule'
  };
};

const runServiceScheduler = async () => {
  const schedules = await ServiceSchedule.find({ isEnabled: true }).lean();
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const results = [];

  for (const schedule of schedules) {
    const normalizedServiceId = normalizeScheduleServiceId(schedule.serviceId);

    if (currentHHMM === schedule.openTime) {
      results.push(await updateServicesOpenState(normalizedServiceId, true));
      continue;
    }

    if (currentHHMM === schedule.closeTime) {
      results.push(await updateServicesOpenState(normalizedServiceId, false));
    }
  }

  return {
    runAt: now.toISOString(),
    processedCount: schedules.length,
    updatedCount: results.length,
    results
  };
};

const adminStartShift = async (staffId) => {
  const staff = await findStaffById(staffId);

  if (staff.onDuty) {
    throw new ApiError(400, 'Nhân viên đang trong ca làm việc');
  }

  const result = await updateShiftStatus(staff, ShiftAction.START, {
    reason: 'Admin mở ca thủ công'
  });

  return {
    onDuty: result.onDuty,
    lastShiftStart: result.lastShiftStart
  };
};

const adminEndShift = async (staffId, { reason = 'Admin kết thúc ca thủ công' } = {}) => {
  const staff = await findStaffById(staffId);

  if (!staff.onDuty) {
    throw new ApiError(400, 'Nhân viên không đang trong ca làm việc');
  }

  const waitingTicketsCount = staff.counterId
    ? await countActiveTicketsForStaff(staffId, staff.counterId)
    : 0;

  const result = await updateShiftStatus(staff, ShiftAction.END, {
    reason,
    waitingTicketsCount
  });

  return {
    onDuty: result.onDuty,
    lastShiftEnd: result.lastShiftEnd,
    waitingTicketsCount
  };
};

module.exports = {
  appendShiftLog,
  autoStartAllShifts,
  countActiveTicketsForStaff,
  deleteSchedule,
  findStaffById,
  getAllSchedules,
  getStaffByShiftStatus,
  getShiftHistoryByStaff,
  adminStartShift,
  adminEndShift,
  applyScheduleNow,
  runServiceScheduler,
  setScheduleEnabled,
  updateShiftStatus,
  upsertSchedule
};
