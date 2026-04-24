const User = require('../models/user.model');
const Ticket = require('../models/ticket.model');
const { TicketStatus, ShiftAction } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const { isShiftSelfManageEnabled } = require('./setting.service');

const findStaffById = async (staffId) => {
  const staff = await User.findById(staffId);

  if (!staff || staff.role !== 'staff') {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  return staff;
};

const assertShiftSelfManageEnabled = async () => {
  const selfManageEnabled = await isShiftSelfManageEnabled();

  if (!selfManageEnabled) {
    throw new ApiError(403, 'Tính năng tự quản lý ca đang bị tắt bởi admin');
  }
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

  return {
    onDuty: staff.onDuty,
    lastShiftStart: staff.lastShiftStart,
    lastShiftEnd: staff.lastShiftEnd,
    waitingTicketsCount
  };
};

const startShift = async (staffId) => {
  await assertShiftSelfManageEnabled();

  const staff = await findStaffById(staffId);

  if (staff.onDuty) {
    throw new ApiError(400, 'Bạn đang trong ca làm việc, không thể bắt đầu ca mới');
  }

  const result = await updateShiftStatus(staff, ShiftAction.START);

  return {
    onDuty: result.onDuty,
    lastShiftStart: result.lastShiftStart,
    message: 'Bắt đầu ca làm việc thành công'
  };
};

const endShift = async (staffId, { reason = '' } = {}) => {
  await assertShiftSelfManageEnabled();

  const staff = await findStaffById(staffId);

  if (!staff.onDuty) {
    throw new ApiError(400, 'Bạn không đang trong ca làm việc');
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
    waitingTicketsCount,
    message: 'Kết thúc ca làm việc thành công'
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
  startShift,
  endShift,
  autoStartAllShifts,
  getStaffByShiftStatus,
  getShiftHistoryByStaff,
  adminStartShift,
  adminEndShift
};
