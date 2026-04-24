const mongoose = require('mongoose');
const { ActiveStatus } = require('../constants/enums');

const ServiceSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,  
    uppercase: true, 
    trim: true, 
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  icon: { 
    type: String
  },
  backgroundColor: {
    type: String
  },
  isActive: { 
    type: Boolean, 
    default: ActiveStatus.ACTIVE 
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  description: { 
    type: String, 
    default: '' 
  },
  displayOrder: { 
    type: Number, 
    default: 0 
  },
  prefixNumber: {
    type: Number,
    default: 0,
    min: 0,
    max: 99
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
ServiceSchema.index(
  { prefixNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { prefixNumber: { $gt: 0 } }
  }
);

module.exports = mongoose.model('Service', ServiceSchema);
