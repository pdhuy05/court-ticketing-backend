const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
    fileName: { type: String, required: true, unique: true },
    backupType: { type: String, enum: ['reset-day', 'reset-all'], required: true },
    backupLabel: { type: String, required: true },
    ticketCount: { type: Number, default: 0 },
    filePath: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    createdBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        fullName: String,
        role: String
    },
    criteria: {
        date: String,
        start: Date,
        end: Date,
        resetScope: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Backup', BackupSchema);
