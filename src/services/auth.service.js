const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

const login = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user) throw new Error('Tên đăng nhập không tồn tại');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Mật khẩu không đúng');

  if (!user.isActive) throw new Error('Tài khoản đã bị khóa');

  user.lastLoginAt = new Date();
  await user.save();

  let expiresIn;
  if (user.role === 'admin') {
    expiresIn = '1h';     
  } else {
    expiresIn = '8h';     
  }

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