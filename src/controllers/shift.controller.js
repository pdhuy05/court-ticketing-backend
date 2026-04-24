const shiftService = require('../services/shift.service');
const asyncHandler = require('../utils/asyncHandler');

exports.startShift = async (req, res) => {
  const result = await shiftService.startShift(req.user._id);
  res.json({ success: true, data: result, message: result.message });
};

exports.endShift = async (req, res) => {
  const { reason } = req.body;
  const result = await shiftService.endShift(req.user._id, { reason });
  res.json({ success: true, data: result, message: result.message });
};

exports.getMyShiftStatus = async (req, res) => {
  const { _id, fullName, username, onDuty, lastShiftStart, lastShiftEnd } = req.user;
  res.json({
    success: true,
    data: { staffId: _id, fullName, username, onDuty, lastShiftStart, lastShiftEnd }
  });
};

exports.getMyShiftHistory = async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 50;
  const result = await shiftService.getShiftHistoryByStaff(req.user._id, limit);
  res.json({ success: true, data: result });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});
