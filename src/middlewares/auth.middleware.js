const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' });
    }

    req.user = user;
    req.user.role = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền truy cập' });
  }
  next();
};

const staffOnly = (req, res, next) => {
  if (req.user.role !== 'staff') {
    return res.status(403).json({ success: false, message: 'Chỉ nhân viên mới có quyền truy cập' });
  }
  next();
};

const counterStaff = (req, res, next) => {
  if (req.user.role === 'staff' && !req.user.counterId) {
    return res.status(403).json({ success: false, message: 'Tài khoản chưa được gán quầy, vui lòng liên hệ quản trị viên' });
  }
  next();
};

module.exports = { authMiddleware, adminOnly, staffOnly, counterStaff };