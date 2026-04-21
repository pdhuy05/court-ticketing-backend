const { ConnectPrint } = require('../constants/enums');
const mongoose = require('mongoose');

const printerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        unique: true,
        required: true
    },
    type: {
        type: String,
        enum: Object.values(ConnectPrint), 
        required: true
    },
    connection: {
        vendorId: String,
        productId: String,
        host: String,
        port: Number,
        macAddress: String
    },
    location: String,
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    lastTestAt: Date,
    lastTestStatus: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success'
    }
}, { timestamps: true });

module.exports = mongoose.model('Printer', printerSchema);