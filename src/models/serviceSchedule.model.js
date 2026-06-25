const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
  openTime: { type: String, required: true, trim: true },
  closeTime: { type: String, required: true, trim: true }
}, { _id: false });

const ServiceScheduleSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    openTime: { type: String, trim: true },
    closeTime: { type: String, trim: true },
    slots: { type: [TimeSlotSchema], default: [] },
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