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

printerSchema.pre('save', function(next) {
    if (this.isDefault) {
        this.constructor.updateMany(
            { _id: { $ne: this._id }, isDefault: true },
            { isDefault: false }
        ).then(() => {
            next();
        }).catch((err) => {
            next(err);
        });
    } else {
        next();
    }
});

module.exports = mongoose.model('Printer', printerSchema);
