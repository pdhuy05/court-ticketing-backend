const mongoose = require('mongoose');

const ServiceScheduleSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    openTime: {
      type: String,
      required: true,
      trim: true
    },
    closeTime: {
      type: String,
      required: true,
      trim: true
    },
    isEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

ServiceScheduleSchema.index({ serviceId: 1 }, { unique: true });

module.exports = mongoose.model('ServiceSchedule', ServiceScheduleSchema);
