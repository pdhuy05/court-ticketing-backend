const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { emitDashboardUpdateSafe } = require('./dashboard.service');

const WEAK_PASSWORD_PATTERNS = ['123456', 'password'];

const ensureStrongPassword = (username, password) => {
  const normalizedUsername = String(username || '').toLowerCase();
  const normalizedPassword = String(password || '').toLowerCase();

  if (normalizedUsername && normalizedPassword.includes(normalizedUsername)) {
    throw new ApiError(400, 'Mật khẩu không được chứa tên đăng nhập');
  }

  if (WEAK_PASSWORD_PATTERNS.some((pattern) => normalizedPassword.includes(pattern))) {
    throw new ApiError(400, 'Mật khẩu quá yếu, không được chứa các chuỗi dễ đoán như "123456" hoặc "password"');
  }
};

const getAllStaff = async () => {
  const staffs = await User.find({ role: 'staff' }).populate('counterId', 'name number');
  return staffs;
};

const getStaffById = async (id) => {
  const staff = await User.findOne({ _id: id, role: 'staff' }).populate('counterId');
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }
  return staff;
};

const createStaff = async (data) => {
  const { username, password, fullName, counterId } = data;

  const existing = await User.findOne({ username });
  if (existing) {
    throw new ApiError(400, 'Tên đăng nhập đã tồn tại');
  }

  ensureStrongPassword(username, password);

  const staff = await User.create({
    username,
    password,
    fullName,
    role: 'staff',
    counterId,
    isActive: true
  });

  await emitDashboardUpdateSafe('staff-created');

  return staff;
};

const updateStaff = async (id, data) => {
  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    data,
    { new: true, runValidators: true }
  );
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-updated');

  return staff;
};

const deleteStaff = async (id) => {
  const staff = await User.findOneAndDelete({ _id: id, role: 'staff' });
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-deleted');

  return staff;
};

const assignCounter = async (id, counterId) => {
  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    { counterId },
    { new: true }
  );
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-counter-assigned');

  return staff;
};

const toggleActive = async (id) => {
  const staff = await User.findOne({ _id: id, role: 'staff' });
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }
  staff.isActive = !staff.isActive;
  await staff.save();

  await emitDashboardUpdateSafe('staff-toggled');

  return staff;
};

const removeCounter = async (id) => {
  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    { counterId: null },
    { new: true, runValidators: true }
  );
  
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-counter-removed');

  return staff;
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  assignCounter,
  toggleActive,
  removeCounter
};
