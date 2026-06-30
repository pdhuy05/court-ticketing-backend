const staffService = require("../../services/staff.service");
const asyncHandler = require("../../utils/asyncHandler");
const { log, AUDIT_ACTIONS } = require("../../services/audit.service");

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

  await log({
    req,
    action: AUDIT_ACTIONS.USER_CREATE,
    status: "success",
    targetId: String(staff._id),
    targetType: "user",
    detail: { username: staff.username, role: staff.role },
  });

  res
    .status(201)
    .json({ success: true, data: staff, message: "Tạo nhân viên thành công" });
};

exports.updateStaff = async (req, res) => {
  const staff = await staffService.updateStaff(req.params.id, req.body);

  const { password, ...safeChanges } = req.body;

  await log({
    req,
    action: AUDIT_ACTIONS.USER_UPDATE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: {
      username: staff.username,
      changes: safeChanges,
      passwordChanged: !!password,
    },
  });

  res.json({ success: true, data: staff, message: "Cập nhật thành công" });
};

exports.deleteStaff = async (req, res) => {
  const staff = await staffService.getStaffById(req.params.id);
  await staffService.deleteStaff(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.USER_DELETE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { username: staff.username },
  });

  res.json({ success: true, message: "Xóa nhân viên thành công" });
};

exports.assignCounter = async (req, res) => {
  const { counterId } = req.body;
  const staff = await staffService.assignCounter(req.params.id, counterId);

  await log({
    req,
    action: AUDIT_ACTIONS.STAFF_COUNTER_ASSIGN,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { username: staff.username, counterId: String(counterId) },
  });

  res.json({ success: true, data: staff, message: "Đã gán phòng thành công" });
};

exports.getStaffServices = async (req, res) => {
  const data = await staffService.getStaffServices(req.params.id);
  res.json({ success: true, data });
};

exports.assignServices = async (req, res) => {
  const data = await staffService.assignServices(
    req.params.id,
    req.body.serviceIds || [],
  );

  await log({
    req,
    action: AUDIT_ACTIONS.STAFF_SERVICES_ASSIGN,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { serviceIds: req.body.serviceIds || [] },
  });

  res.json({
    success: true,
    data,
    message: "Đã cập nhật quầy cho nhân viên thành công",
  });
};

exports.toggleActive = async (req, res) => {
  const staff = await staffService.toggleActive(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.USER_TOGGLE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { username: staff.username, isActive: staff.isActive },
  });

  res.json({
    success: true,
    data: staff,
    message: "Cập nhật trạng thái nhân viên thành công",
  });
};

exports.removeCounter = async (req, res) => {
  const staff = await staffService.removeCounter(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.STAFF_COUNTER_REMOVE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { username: staff.username },
  });

  res.json({
    success: true,
    data: staff,
    message: "Đã gỡ phòng khỏi nhân viên thành công",
  });
};

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

  await log({
    req,
    action: AUDIT_ACTIONS.USER_CREATE,
    status: "success",
    targetId: String(admin._id),
    targetType: "user",
    detail: { username: admin.username, role: admin.role },
  });

  res
    .status(201)
    .json({
      success: true,
      data: admin,
      message: "Tạo tài khoản admin thành công",
    });
};

exports.updateAdmin = async (req, res) => {
  const admin = await staffService.updateAdmin(req.params.id, req.body);

  const { password, ...safeChanges } = req.body;

  await log({
    req,
    action: AUDIT_ACTIONS.USER_UPDATE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: {
      username: admin.username,
      changes: safeChanges,
      passwordChanged: !!password,
    },
  });

  res.json({
    success: true,
    data: admin,
    message: "Cập nhật admin thành công",
  });
};

exports.deleteAdmin = async (req, res) => {
  const admin = await staffService.getAdminById(req.params.id);
  await staffService.deleteAdmin(req.params.id, req.user._id);

  await log({
    req,
    action: AUDIT_ACTIONS.USER_DELETE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { username: admin.username },
  });

  res.json({ success: true, message: "Xóa tài khoản admin thành công" });
};

exports.toggleAdminActive = async (req, res) => {
  const admin = await staffService.toggleAdminActive(
    req.params.id,
    req.user._id,
  );

  await log({
    req,
    action: AUDIT_ACTIONS.USER_TOGGLE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: { username: admin.username, isActive: admin.isActive },
  });

  res.json({
    success: true,
    data: admin,
    message: "Cập nhật trạng thái admin thành công",
  });
};

const ALL_PERMISSIONS = [
  "dashboard",
  "users",
  "counter",
  "services",
  "printers",
  "settings",
  "reports",
  "search",
  "shift",
  "audit-logs",
];

exports.getAdminPermissions = async (req, res) => {
  const User = require("../../models/user.model");
  const user = await User.findById(req.params.id).select(
    "fullName username role adminPermissions isSuperAdmin",
  );
  if (!user)
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy người dùng" });
  if (user.role !== "admin")
    return res
      .status(400)
      .json({ success: false, message: "Chỉ áp dụng cho tài khoản admin" });

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
  const User = require("../../models/user.model");
  const { permissions, isSuperAdmin } = req.body;

  if (String(req.params.id) === String(req.user._id)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Không thể chỉnh sửa quyền của chính mình",
      });
  }

  const user = await User.findById(req.params.id);
  if (!user)
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy người dùng" });
  if (user.role !== "admin")
    return res
      .status(400)
      .json({ success: false, message: "Chỉ áp dụng cho tài khoản admin" });

  if (typeof isSuperAdmin === "boolean") user.isSuperAdmin = isSuperAdmin;

  if (permissions === null) {
    user.adminPermissions = null;
  } else if (Array.isArray(permissions)) {
    const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Quyền không hợp lệ: ${invalid.join(", ")}`,
        });
    }
    user.adminPermissions = permissions;
  }

  await user.save();

  await log({
    req,
    action: AUDIT_ACTIONS.USER_PERMISSION_UPDATE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "user",
    detail: {
      username: user.username,
      permissions: user.adminPermissions,
      isSuperAdmin: user.isSuperAdmin,
    },
  });

  res.json({
    success: true,
    data: {
      _id: user._id,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      adminPermissions: user.adminPermissions,
    },
    message: "Cập nhật quyền thành công",
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});