const mongoose = require("mongoose");
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
    enum: Object.values(ServiceName) 
  },
  icon: { 
    type: String, 
    default: "fa-solid fa-scale-unbalanced-flip" 
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
  },
}, {
  timestamps: true
});

ServiceSchema.virtual('counters', {
  ref: 'Counter',
  localField: '_id',
  foreignField: 'serviceId'
});

module.exports = mongoose.model('Service', ServiceSchema);