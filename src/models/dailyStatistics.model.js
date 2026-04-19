const mongoose = require('mongoose');

const byServiceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    serviceCode: { type: String, default: '' },
    serviceName: { type: String, default: '' },
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    avgWaitingTime: { type: Number, default: 0 },
    avgProcessingTime: { type: Number, default: 0 }
  },
  { _id: false }
);

const byCounterSchema = new mongoose.Schema(
  {
    counterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      required: true
    },
    counterName: { type: String, default: '' },
    counterNumber: { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },
    avgProcessingTime: { type: Number, default: 0 }
  },
  { _id: false }
);

const byStaffSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    staffName: { type: String, default: '' },
    username: { type: String, default: '' },
    processedCount: { type: Number, default: 0 },
    avgProcessingTime: { type: Number, default: 0 },
    skipCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const resetBySchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: '' },
    fullName: { type: String, default: '' }
  },
  { _id: false }
);

const dailyStatisticsSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date phải có định dạng YYYY-MM-DD']
    },
    totalTickets: { type: Number, default: 0 },
    completedTickets: { type: Number, default: 0 },
    skippedTickets: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    skipRate: { type: Number, default: 0 },
    avgWaitingTime: { type: Number, default: 0 },
    avgProcessingTime: { type: Number, default: 0 },
    byService: { type: [byServiceSchema], default: [] },
    byCounter: { type: [byCounterSchema], default: [] },
    byStaff: { type: [byStaffSchema], default: [] },
    resetBy: { type: resetBySchema, default: null },
    resetAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: 'daily_statistics'
  }
);

module.exports = mongoose.model('DailyStatistics', dailyStatisticsSchema);
