const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { emitDashboardUpdateSafe } = require('./dashboard.service');
const {
  getStaffServiceSummary,
  assignServicesToStaff
} = require('./staff-permission.service');

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

const enrichStaff = async (staff) => {
  if (!staff) {
    return staff;
  }

  const staffObject = typeof staff.toObject === 'function'
    ? staff.toObject()
    : { ...staff };

  const serviceSummary = await getStaffServiceSummary(staffObject._id);

  return {
    ...staffObject,
    serviceRestrictionConfigured: serviceSummary.serviceRestrictionConfigured,
    availableServices: serviceSummary.availableServices,
    assignedServices: serviceSummary.assignedServices,
    effectiveServices: serviceSummary.effectiveServices
  };
};

const getAllStaff = async () => {
  const staffs = await User.find({ role: 'staff' }).populate('counterId', 'name number');
  return Promise.all(staffs.map(enrichStaff));
};

const getStaffById = async (id) => {
  const staff = await User.findOne({ _id: id, role: 'staff' }).populate('counterId');
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }
  return enrichStaff(staff);
};

const createStaff = async (data) => {
  const { username, password, fullName, counterId, isActive } = data;

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
    isActive: isActive !== undefined ? isActive : true
  });

  await emitDashboardUpdateSafe('staff-created');

  return enrichStaff(staff);
};

const updateStaff = async (id, data) => {
  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    data,
    { returnDocument: 'after', runValidators: true }
  );
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-updated');

  return enrichStaff(staff);
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
    { returnDocument: 'after' }
  );
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-counter-assigned');

  return enrichStaff(staff);
};

const getStaffServices = async (id) => {
  return getStaffServiceSummary(id);
};

const assignServices = async (id, serviceIds = []) => {
  const serviceSummary = await assignServicesToStaff(id, serviceIds);

  await emitDashboardUpdateSafe('staff-services-assigned');

  return {
    staffId: id,
    serviceRestrictionConfigured: serviceSummary.serviceRestrictionConfigured,
    availableServices: serviceSummary.availableServices,
    assignedServices: serviceSummary.assignedServices,
    effectiveServices: serviceSummary.allowedServices
  };
};

const toggleActive = async (id) => {
  const staff = await User.findOne({ _id: id, role: 'staff' });
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }
  staff.isActive = !staff.isActive;
  await staff.save();

  await emitDashboardUpdateSafe('staff-toggled');

  return enrichStaff(staff);
};

const removeCounter = async (id) => {
  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    { counterId: null },
    { returnDocument: 'after', runValidators: true }
  );
  
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  await emitDashboardUpdateSafe('staff-counter-removed');

  return enrichStaff(staff);
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  assignCounter,
  getStaffServices,
  assignServices,
  toggleActive,
  removeCounter
};
