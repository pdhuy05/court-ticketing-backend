const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    collection: 'settings',
    timestamps: true
  }
);

module.exports = mongoose.model('Setting', settingSchema);
