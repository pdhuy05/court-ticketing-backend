require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const logger = require('../utils/logger');  // Đảm bảo đường dẫn đúng

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      logger.warning('Admin đã tồn tại!');
      await mongoose.disconnect();
      process.exit(0);
    }

    const admin = new User({
      username: 'admin',
      password: 'admin',       
      fullName: 'TANDKV1 - TP HCM',
      role: 'admin',
      isActive: true
    });

    await admin.save();
    logger.success(`
╔════════════════════════════════════╗
║        TẠO ADMIN THÀNH CÔNG!       ║
╠════════════════════════════════════╣
║ Username: ${admin.username.padEnd(25)}║
║ FullName: ${admin.fullName.padEnd(25)}║
║ Password: *********${' '.padEnd(16)}║
║ Role: ${admin.role.padEnd(29)}║
╚════════════════════════════════════╝
`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error(`Lỗi: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();