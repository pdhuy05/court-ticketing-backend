const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  counterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Counter', default: null },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  logger.info('Đang mã hóa mật khẩu...');

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);