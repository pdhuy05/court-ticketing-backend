const mongoose = require('mongoose');

const CounterSequenceSchema = new mongoose.Schema({
  counterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    required: true
  },
  lastNumber: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

CounterSequenceSchema.index({ counterId: 1 }, { unique: true, name: 'unique_counter_sequence_counterId' });

module.exports = mongoose.model('CounterSequence', CounterSequenceSchema);
