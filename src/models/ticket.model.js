const mongoose = require('mongoose');
const { TicketStatus } = require('../constants/enums');

const TicketSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    index: true
  },

  ticketNumber: {
    type: String,
    required: true,
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true
  },

  counterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    default: null,
    index: true
  },

  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },

  queueCounterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    index: true
  },

  serviceCounterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCounter',
    default: null,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[0-9]{8,15}$/, 'Số điện thoại phải gồm ít nhất 8 chữ số'],
    minlength: 8,
    maxlength: 15
  },

  status: {
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.WAITING,
    required: true
  },

  calledAt: {
    type: Date,
    default: null
  },
  
  processingAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  },

  skippedAt: {
    type: Date,
    default: null
  },

  waitingDuration: {
    type: Number,
    default: 0,
    min: 0
  },

  processingDuration: {
    type: Number,
    default: 0,
    min: 0
  },

  totalDuration: {
    type: Number,
    default: 0,
    min: 0
  },

  qrData: {
    type: String, 
    default: null 
  },

  displayUsesServicePrefix: {
    type: Boolean,
    default: false
  },

  isRecall: {
    type: Boolean,
    default: false,
    index: true
  },

  recalledAt: {
    type: Date,
    default: null
  },

  recallCounterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    default: null,
    index: true
  },

  skipCount: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: true
});

TicketSchema.index({ status: 1, createdAt: 1 });
TicketSchema.index({ serviceId: 1, status: 1 });
TicketSchema.index({ counterId: 1, status: 1 });
TicketSchema.index({ staffId: 1, status: 1 });
TicketSchema.index({ queueCounterId: 1, status: 1 });
TicketSchema.index({ isRecall: 1, status: 1, recalledAt: 1 });
TicketSchema.index({ recallCounterId: 1, isRecall: 1, status: 1, recalledAt: 1 });

TicketSchema.index(
  { queueCounterId: 1, number: 1 },
  { 
    unique: true, 
    sparse: true,
    name: 'unique_queueCounterId_number'
  }
);

TicketSchema.index(
  { queueCounterId: 1, ticketNumber: 1 },
  { 
    unique: true, 
    sparse: true,
    name: 'unique_queueCounterId_ticketNumber'
  }
);

module.exports = mongoose.model('Ticket', TicketSchema);
