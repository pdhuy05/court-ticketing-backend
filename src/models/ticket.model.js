const mongoose = require('mongoose');
const { TicketStatus, Gender } = require('../constants/enums'); 

const TicketSchema = new mongoose.Schema({
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

  name: {
    type: String,
    required: true,
    trim: true
  },

  gender: {
    type: String,
    enum: Object.values(Gender),
    default: Gender.OTHER,
    required: true
  },

  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^0[0-9]{9,10}$/, 'Số điện thoại không hợp lệ'],   
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

module.exports = mongoose.model('Ticket', TicketSchema);