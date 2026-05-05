const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const Counter = require("../models/counter.model");
const { getStaffServiceAccess } = require("./staff-permission.service");

const login = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user) throw new ApiError(401, "Tên đăng nhập không tồn tại");

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, "Mật khẩu không đúng");

  if (!user.isActive) throw new ApiError(403, "Tài khoản đã bị khóa");

  if (user.role === "staff") {
    if (!user.counterId) {
      throw new ApiError(
        403,
        "Tài khoản chưa được gán phòng. Vui lòng liên hệ quản trị viên.",
      );
    }

    const counter = await Counter.findById(user.counterId);
    if (!counter || !counter.isActive) {
      throw new ApiError(
        403,
        "Phòng của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      );
    }

    const access = await getStaffServiceAccess(user._id, user.counterId);

    if (!access.assignedServices || access.assignedServices.length === 0) {
      throw new ApiError(
        403,
        "Tài khoản không có quầy nào đang hoạt động. Vui lòng liên hệ quản trị viên để được cấp quyền quầy.",
      );
    }
  }

  user.lastLoginAt = new Date();
  await user.save();

  const expiresIn = "8h";

  const token = jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn },
  );

  return {
    token,
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      counterId: user.counterId,
    },
  };
};

module.exports = { login };
