const User = require('../models/user.model');
const StaffService = require('../models/staffService.model');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

const login = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user) throw new ApiError(401, 'Tên đăng nhập không tồn tại');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Mật khẩu không đúng');

  if (!user.isActive) throw new ApiError(403, 'Tài khoản đã bị khóa');

  if (user.role === 'staff') {
    const hasCounter = !!user.counterId;
    const hasService = await StaffService.exists({ staffId: user._id, isActive: true });

    if (!hasCounter || !hasService) {
      throw new ApiError(403, 'Bạn chưa được gán quầy hoặc dịch vụ. Vui lòng liên hệ admin.');
    }
  }

  user.lastLoginAt = new Date();
  await user.save();

  const expiresIn = '8h';

  const token = jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  return {
    token,
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      counterId: user.counterId
    }
  };
};

module.exports = { login };