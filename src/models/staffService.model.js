const mongoose = require('mongoose');

const StaffServiceSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  note: {
    type: String,
    default: ''
  }
}, { timestamps: true });

StaffServiceSchema.index({ staffId: 1, serviceId: 1 }, { unique: true });
StaffServiceSchema.index({ staffId: 1, isActive: 1 });
StaffServiceSchema.index({ serviceId: 1, isActive: 1 });

module.exports = mongoose.model('StaffService', StaffServiceSchema);
