const mongoose = require('mongoose');
const { ActiveStatus } = require('../constants/enums');

const CounterSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,  
    uppercase: true, 
    trim: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  number: {                    
    type: Number, 
    required: true, 
    unique: true,   
    min: 1 
  },
  isActive: { 
    type: Boolean, 
    default: ActiveStatus.ACTIVE 
  },
  processedCount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  currentTicketId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ticket', 
    default: null 
  },
  note: { 
    type: String, 
    default: '' 
  }
}, {
  timestamps: true
});

CounterSchema.virtual('services', {
  ref: 'ServiceCounter',
  localField: '_id',
  foreignField: 'counterId'
});

CounterSchema.index({ isActive: 1 });

module.exports = mongoose.model('Counter', CounterSchema);