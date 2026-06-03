const staffService = require("../../services/staff.service");
const asyncHandler = require("../../utils/asyncHandler");

// ── STAFF ────────────────────────────────────────────────────────────────────

exports.getAllStaff = async (req, res) => {
  const staffs = await staffService.getAllStaff();
  res.json({ success: true, data: staffs });
};

exports.getStaffById = async (req, res) => {
  const staff = await staffService.getStaffById(req.params.id);
  res.json({ success: true, data: staff });
};

exports.createStaff = async (req, res) => {
  const staff = await staffService.createStaff(req.body);
  res.status(201).json({ success: true, data: staff, message: "Tạo nhân viên thành công" });
};

exports.updateStaff = async (req, res) => {
  const staff = await staffService.updateStaff(req.params.id, req.body);
  res.json({ success: true, data: staff, message: "Cập nhật thành công" });
};

exports.deleteStaff = async (req, res) => {
  await staffService.deleteStaff(req.params.id);
  res.json({ success: true, message: "Xóa nhân viên thành công" });
};

exports.assignCounter = async (req, res) => {
  const { counterId } = req.body;
  const staff = await staffService.assignCounter(req.params.id, counterId);
  res.json({ success: true, data: staff, message: "Đã gán phòng thành công" });
};

exports.getStaffServices = async (req, res) => {
  const data = await staffService.getStaffServices(req.params.id);
  res.json({ success: true, data });
};

exports.assignServices = async (req, res) => {
  const data = await staffService.assignServices(req.params.id, req.body.serviceIds || []);
  res.json({ success: true, data, message: "Đã cập nhật quầy cho nhân viên thành công" });
};

exports.toggleActive = async (req, res) => {
  const staff = await staffService.toggleActive(req.params.id);
  res.json({ success: true, data: staff, message: `${staff.isActive ? "Kích hoạt" : "Vô hiệu hóa"} nhân viên thành công` });
};

exports.removeCounter = async (req, res) => {
  const staff = await staffService.removeCounter(req.params.id);
  res.json({ success: true, data: staff, message: "Đã gỡ phòng khỏi nhân viên thành công" });
};

// ── ADMIN ACCOUNTS ───────────────────────────────────────────────────────────

exports.getAllAdmins = async (req, res) => {
  const admins = await staffService.getAllAdmins();
  res.json({ success: true, data: admins });
};

exports.getAdminById = async (req, res) => {
  const admin = await staffService.getAdminById(req.params.id);
  res.json({ success: true, data: admin });
};

exports.createAdmin = async (req, res) => {
  const admin = await staffService.createAdmin(req.body);
  res.status(201).json({ success: true, data: admin, message: "Tạo tài khoản admin thành công" });
};

exports.updateAdmin = async (req, res) => {
  const admin = await staffService.updateAdmin(req.params.id, req.body);
  res.json({ success: true, data: admin, message: "Cập nhật admin thành công" });
};

exports.deleteAdmin = async (req, res) => {
  await staffService.deleteAdmin(req.params.id, req.user._id);
  res.json({ success: true, message: "Xóa tài khoản admin thành công" });
};

exports.toggleAdminActive = async (req, res) => {
  const admin = await staffService.toggleAdminActive(req.params.id, req.user._id);
  res.json({ success: true, data: admin, message: `${admin.isActive ? "Kích hoạt" : "Vô hiệu hóa"} admin thành công` });
};

// ── PHÂN QUYỀN ADMIN ────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  'dashboard', 'users', 'counter', 'services',
  'printers', 'settings', 'reports', 'search', 'shift',
];

exports.getAdminPermissions = async (req, res) => {
  const User = require('../../models/user.model');
  const user = await User.findById(req.params.id).select('fullName username role adminPermissions isSuperAdmin');
  if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
  if (user.role !== 'admin') return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho tài khoản admin' });

  res.json({
    success: true,
    data: {
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      isSuperAdmin: user.isSuperAdmin,
      adminPermissions: user.adminPermissions,
      allPermissions: ALL_PERMISSIONS,
    },
  });
};

exports.updateAdminPermissions = async (req, res) => {
  const User = require('../../models/user.model');
  const { permissions, isSuperAdmin } = req.body;

  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'Không thể chỉnh sửa quyền của chính mình' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
  if (user.role !== 'admin') return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho tài khoản admin' });

  if (typeof isSuperAdmin === 'boolean') user.isSuperAdmin = isSuperAdmin;

  if (permissions === null) {
    user.adminPermissions = null;
  } else if (Array.isArray(permissions)) {
    const invalid = permissions.filter(p => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      return res.status(400).json({ success: false, message: `Quyền không hợp lệ: ${invalid.join(', ')}` });
    }
    user.adminPermissions = permissions;
  }

  await user.save();
  res.json({
    success: true,
    data: { _id: user._id, fullName: user.fullName, isSuperAdmin: user.isSuperAdmin, adminPermissions: user.adminPermissions },
    message: 'Cập nhật quyền thành công',
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});