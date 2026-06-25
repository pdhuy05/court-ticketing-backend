const User    = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const Counter  = require("../models/counter.model");
const { getStaffServiceAccess } = require("./staff-permission.service");
const { issueTokens, refreshAccess, revokeToken, revokeAll } = require("./refreshToken.service");
const { log, AUDIT_ACTIONS } = require("./audit.service");

const toCounterSnapshot = (counter) => {
  if (!counter) return null;
  return {
    _id: counter._id,
    id: counter._id,
    code: counter.code,
    name: counter.name,
    number: counter.number,
    isActive: counter.isActive,
  };
};

const buildUserProfile = async (user) => {
  const userObject =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

  const counter =
    userObject.counterId && typeof userObject.counterId === "object"
      ? userObject.counterId
      : userObject.counterId
        ? await Counter.findById(userObject.counterId)
            .select("code name number isActive")
            .lean()
        : null;

  let serviceAccess = {
    availableServices: [],
    assignedServices: [],
    effectiveServices: [],
    serviceRestrictionConfigured: userObject.role === "staff",
  };

  if (userObject.role === "staff" && userObject._id && userObject.counterId) {
    const access = await getStaffServiceAccess(
      userObject._id,
      counter?._id || userObject.counterId,
    );
    serviceAccess = {
      availableServices: access.availableServices,
      assignedServices: access.assignedServices,
      effectiveServices: access.allowedServices,
      serviceRestrictionConfigured: access.serviceRestrictionConfigured,
    };
  }

  return {
    _id: userObject._id,
    id: userObject._id,
    username: userObject.username,
    fullName: userObject.fullName,
    role: userObject.role,
    counterId: counter?._id ? String(counter._id) : null,
    counter: toCounterSnapshot(counter),
    isActive: userObject.isActive,
    lastLoginAt: userObject.lastLoginAt || null,
    onDuty: userObject.onDuty,
    lastShiftStart: userObject.lastShiftStart || null,
    lastShiftEnd: userObject.lastShiftEnd   || null,
    createdAt: userObject.createdAt || null,
    updatedAt: userObject.updatedAt || null,
    email: userObject.email    || null,
    phone: userObject.phone    || null,
    address: userObject.address  || null,
    isSuperAdmin:  userObject.isSuperAdmin ?? false,
    adminPermissions: userObject.adminPermissions ?? null,
    ...serviceAccess,
  };
};

const login = async (username, password, meta = {}) => {
  const user = await User.findOne({ username });

  if (!user) {
    await log({
      actor:  { username, role: "system" },
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      status: "failed",
      detail: { reason: "Tên đăng nhập không tồn tại", username },
      ...meta,
    });
    throw new ApiError(401, "Tên đăng nhập không tồn tại");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await log({
      actor:  { id: user._id, username: user.username, role: user.role },
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      status: "failed",
      detail: { reason: "Mật khẩu không đúng" },
      ...meta,
    });
    throw new ApiError(401, "Mật khẩu không đúng");
  }

  if (!user.isActive) {
    await log({
      actor:  { id: user._id, username: user.username, role: user.role },
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      status: "failed",
      detail: { reason: "Tài khoản đã bị khóa" },
      ...meta,
    });
    throw new ApiError(403, "Tài khoản đã bị khóa");
  }

  if (user.role === "staff") {
    if (!user.counterId) {
      throw new ApiError(403, "Tài khoản chưa được gán phòng. Vui lòng liên hệ quản trị viên.");
    }
    const counter = await Counter.findById(user.counterId);
    if (!counter || !counter.isActive) {
      throw new ApiError(403, "Phòng của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
    }
    const access = await getStaffServiceAccess(user._id, user.counterId);
    if (!access.assignedServices || access.assignedServices.length === 0) {
      throw new ApiError(403, "Tài khoản không có quầy nào đang hoạt động. Vui lòng liên hệ quản trị viên để được cấp quyền quầy.");
    }
  }

  user.lastLoginAt = new Date();
  await user.save({ timestamps: false });

  const tokens = await issueTokens(user, meta);

  await log({
    actor:  { id: user._id, username: user.username, role: user.role },
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    status: "success",
    detail: { role: user.role },
    ...meta,
  });

  return {
    ...tokens,
    user: await buildUserProfile(user),
  };
};

const logout = async (refreshTokenString, user, meta = {}) => {
  if (refreshTokenString) {
    await revokeToken(refreshTokenString, "logout");
  }
  await log({
    actor:  { id: user?._id, username: user?.username, role: user?.role },
    action: AUDIT_ACTIONS.LOGOUT,
    status: "success",
    ...meta,
  });
};

const refreshToken = async (refreshTokenString, meta = {}) => {
  return refreshAccess(refreshTokenString, meta);
};

const getMe = async (userId) => {
  const user = await User.findById(userId)
    .select("-password")
    .populate("counterId", "code name number isActive");

  if (!user || !user.isActive) {
    throw new ApiError(401, "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa");
  }

  return buildUserProfile(user);
};

const updateMyProfile = async (userId, updates, meta = {}) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new ApiError(401, "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa");
  }

  const passwordChanged = !!updates.newPassword;

  if (passwordChanged) {
    if (!updates.currentPassword) {
      throw new ApiError(400, "Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu");
    }
    const isMatch = await user.comparePassword(updates.currentPassword);
    if (!isMatch) throw new ApiError(400, "Mật khẩu hiện tại không đúng");
    user.password = updates.newPassword;
  }

  if (updates.fullName !== undefined) user.fullName = updates.fullName;
  if (updates.email !== undefined) user.email = updates.email || null;
  if (updates.phone !== undefined) user.phone = updates.phone || null;
  if (updates.address !== undefined) user.address = updates.address || null;

  await user.save();

  if (passwordChanged) {
    await revokeAll(userId, "password_changed");
    await log({
      actor:  { id: user._id, username: user.username, role: user.role },
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      status: "success",
      ...meta,
    });
  }

  const freshUser = await User.findById(userId)
    .select("-password")
    .populate("counterId", "code name number isActive");

  return buildUserProfile(freshUser);
};

module.exports = { getMe, login, logout, refreshToken, updateMyProfile };