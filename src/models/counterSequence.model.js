const mongoose = require('mongoose');

const CounterSequenceSchema = new mongoose.Schema({
  counterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    required: true,
    unique: true,
    index: true
  },
  lastNumber: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CounterSequence', CounterSequenceSchema);
