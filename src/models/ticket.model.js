const mongoose = require('mongoose');
const { TicketStatus, Gender } = require('../constants/enums'); 

const TicketSchema = new mongoose.Schema({
   number: {          
    type: Number,
    required: true,
    index: true
  },

  ticketNumber: {          
    type: String,
    required: true,
    unique: true
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
    match: [/^(03|05|07|08|09|01[2|6|8|9])[0-9]{7,8}$/, 'Số điện thoại không hợp lệ (VD: 0912345678)'],
    minlength: 10,
    maxlength: 11
  },
  
  status: {
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.WAITING,
    required: true
  },
  
  processingAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true 
});

// Indexes
TicketSchema.index({ status: 1, createdAt: 1 });        
TicketSchema.index({ serviceId: 1, status: 1 });       
TicketSchema.index({ counterId: 1, status: 1 });
TicketSchema.index({ serviceId: 1, number: 1 }, { unique: true }); 

module.exports = mongoose.model('Ticket', TicketSchema);