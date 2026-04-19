const mongoose = require('mongoose');

const ServiceCounterSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  counterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
}, {
  timestamps: true
});


ServiceCounterSchema.index({ serviceId: 1, counterId: 1 }, { unique: true });

ServiceCounterSchema.index({ serviceId: 1, isActive: 1 });
ServiceCounterSchema.index({ counterId: 1, isActive: 1 });
ServiceCounterSchema.index({ counterId: 1, serviceId: 1, isActive: 1 });

module.exports = mongoose.model('ServiceCounter', ServiceCounterSchema);