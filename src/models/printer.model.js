const { ConnectPrint } = require('../constants/enums');
const mongoose = require('mongoose');

const normalizeUpdatePayload = (update = {}) => {
    if (!update) {
        return {};
    }

    if (update.$set) {
        return update.$set;
    }

    return update;
};

const printerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        uppercase: true
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

printerSchema.pre('validate', function(next) {
    if (this.type === ConnectPrint.NETWORK) {
        if (!this.connection) {
            this.connection = {};
        }

        if (!this.connection.host) {
            return next(new Error('Host máy in network là bắt buộc'));
        }

        if (!this.connection.port) {
            this.connection.port = 9100;
        }
    }

    next();
});

printerSchema.pre('save', async function(next) {
    try {
        if (this.type === ConnectPrint.NETWORK) {
            if (!this.connection) {
                this.connection = {};
            }

            if (!this.connection.port) {
                this.connection.port = 9100;
            }
        }

        if (this.isDefault) {
            await this.constructor.updateMany(
                { _id: { $ne: this._id }, isDefault: true },
                { isDefault: false }
            );
        }

        next();
    } catch (error) {
        next(error);
    }
});

printerSchema.pre('findOneAndUpdate', async function(next) {
    try {
        const update = normalizeUpdatePayload(this.getUpdate());
        const query = this.getQuery();
        const currentPrinter = await this.model.findOne(query).lean();
        const nextType = update.type || currentPrinter?.type;
        const connection = {
            ...(currentPrinter?.connection || {}),
            ...(update.connection || {})
        };

        if (nextType === ConnectPrint.NETWORK) {
            if (!connection?.host) {
                return next(new Error('Host máy in network là bắt buộc'));
            }

            if (!connection.port) {
                if (this.getUpdate().$set) {
                    this.getUpdate().$set.connection = {
                        ...connection,
                        port: 9100
                    };
                } else {
                    this.getUpdate().connection = {
                        ...connection,
                        port: 9100
                    };
                }
            }
        }

        if (update.isDefault === true) {
            await this.model.updateMany(
                { _id: { $ne: query._id }, isDefault: true },
                { isDefault: false }
            );
        }

        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Printer', printerSchema);
