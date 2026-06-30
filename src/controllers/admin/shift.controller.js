const shiftService = require("../../services/shift.service");
const settingService = require("../../services/setting.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.getShiftSettings = async (req, res) => {
  const data = await settingService.getShiftSettings();
  res.json({ success: true, data });
};

exports.patchAutoStartTime = async (req, res) => {
  const value = await settingService.setShiftAutoStartTime(req.body.time);
  res.json({
    success: true,
    data: { autoStartTime: value },
    message: `Đã cập nhật thời gian tự động mở ca thành ${value}`,
  });
};

exports.patchReminderMinutes = async (req, res) => {
  const value = await settingService.setShiftReminderMinutes(req.body.minutes);
  res.json({
    success: true,
    data: { reminderMinutes: value },
    message: `Đã cập nhật thời gian nhắc nhở thành ${value} phút`,
  });
};

exports.getOnDutyStaff = async (req, res) => {
  const data = await shiftService.getStaffByShiftStatus(true);
  res.json({ success: true, data });
};

exports.getOffDutyStaff = async (req, res) => {
  const data = await shiftService.getStaffByShiftStatus(false);
  res.json({ success: true, data });
};

exports.getAllStaffShiftStatus = async (req, res) => {
  const data = await shiftService.getStaffByShiftStatus(null);
  res.json({ success: true, data });
};

exports.getStaffShiftHistory = async (req, res) => {
  const { staffId } = req.params;
  const limit = Number.parseInt(req.query.limit, 10) || 50;
  const data = await shiftService.getShiftHistoryByStaff(staffId, limit);
  res.json({ success: true, data });
};

exports.adminStartShift = async (req, res) => {
  const { staffId } = req.params;
  const data = await shiftService.adminStartShift(staffId, req);
  res.json({ success: true, data, message: "Đã mở ca cho nhân viên" });
};

exports.adminEndShift = async (req, res) => {
  const { staffId } = req.params;
  const { reason } = req.body;
  const data = await shiftService.adminEndShift(staffId, { reason }, req);
  res.json({ success: true, data, message: "Đã kết thúc ca cho nhân viên" });
};

exports.getServiceSchedules = async (req, res) => {
  const data = await shiftService.getAllSchedules();
  res.json({ success: true, data });
};

exports.upsertServiceSchedule = async (req, res) => {
  const data = await shiftService.upsertSchedule(req.body);
  res.json({ success: true, data, message: "Đã lưu lịch quầy thành công" });
};

exports.deleteServiceSchedule = async (req, res) => {
  const data = await shiftService.deleteSchedule(req.params.serviceId);
  res.json({ success: true, data, message: "Đã xóa lịch quầy thành công" });
};

exports.toggleServiceSchedule = async (req, res) => {
  const data = await shiftService.setScheduleEnabled(
    req.params.serviceId,
    req.body.isEnabled,
  );
  res.json({
    success: true,
    data,
    message: req.body.isEnabled ? "Đã bật lịch quầy" : "Đã tắt lịch quầy",
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});

exports.setServiceManualOverride = async (req, res) => {
  const { serviceId } = req.params;
  const { override } = req.body;

  if (override === null || override === undefined || override === 'null') {
    const data = await shiftService.clearManualOverride(serviceId);
    return res.json({ success: true, data, message: 'Đã trả về chế độ tự động theo lịch' });
  }

  const data = await shiftService.setManualOverride(serviceId, override);
  const msg = override === 'open' ? 'Đã mở dịch vụ ngay lập tức' : 'Đã đóng dịch vụ ngay lập tức';
  return res.json({ success: true, data, message: msg });
};