const mongoose = require('mongoose');
const { ServiceCode, ActiveStatus, ServiceName } = require('../constants/enums');

const ServiceSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,  
    uppercase: true, 
    trim: true, 
    enum: Object.values(ServiceCode)
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  
  icon: { 
    type: String, 
    default: 'fa-solid fa-scale-unbalanced-flip' 
  },
  isActive: { 
    type: Boolean, 
    default: ActiveStatus.ACTIVE 
  },
  description: { 
    type: String, 
    default: '' 
  },
  displayOrder: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ServiceSchema.virtual('serviceCounters', {
  ref: 'ServiceCounter',
  localField: '_id',
  foreignField: 'serviceId'
});

ServiceSchema.virtual('counters', {
  ref: 'ServiceCounter',
  localField: '_id',
  foreignField: 'serviceId',
  justOne: false,
  options: { sort: { displayOrder: 1, createdAt: 1 } }
});

ServiceSchema.index({ isActive: 1, displayOrder: 1 });
ServiceSchema.index({ name: 1 });

module.exports = mongoose.model('Service', ServiceSchema);