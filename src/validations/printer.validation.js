const Joi = require('joi');
const { ConnectPrint } = require('../constants/enums');
const { idParamSchema, objectId } = require('./common.validation');

const printerCodeParamSchema = Joi.object({
  code: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Mã máy in là bắt buộc',
      'string.empty': 'Mã máy in không được để trống'
    })
});

const connectionSchema = Joi.object({
  vendorId: Joi.string().trim().allow('', null),
  productId: Joi.string().trim().allow('', null),
  host: Joi.string().trim().hostname().allow('', null),
  port: Joi.number().integer().min(1).max(65535),
  macAddress: Joi.string().trim().allow('', null)
}).default({});

const networkConnectionSchema = connectionSchema.keys({
  host: Joi.string().trim().hostname().required().messages({
    'any.required': 'Host máy in network là bắt buộc',
    'string.empty': 'Host máy in network không được để trống',
    'string.hostname': 'Host máy in network không hợp lệ'
  }),
  port: Joi.number().integer().min(1).max(65535).default(9100).messages({
    'number.base': 'Port máy in network phải là số',
    'number.min': 'Port máy in network phải lớn hơn 0',
    'number.max': 'Port máy in network không hợp lệ'
  })
});

const createPrinterSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Tên máy in là bắt buộc',
    'string.empty': 'Tên máy in không được để trống',
    'string.min': 'Tên máy in phải có ít nhất 2 ký tự',
    'string.max': 'Tên máy in không được vượt quá 100 ký tự'
  }),
  code: Joi.string().trim().uppercase().min(2).max(50).pattern(/^[A-Z0-9_-]+$/).required().messages({
    'any.required': 'Mã máy in là bắt buộc',
    'string.empty': 'Mã máy in không được để trống',
    'string.min': 'Mã máy in phải có ít nhất 2 ký tự',
    'string.max': 'Mã máy in không được vượt quá 50 ký tự',
    'string.pattern.base': 'Mã máy in chỉ được chứa chữ hoa, số, dấu gạch ngang và gạch dưới'
  }),
  type: Joi.string().valid(...Object.values(ConnectPrint)).required().messages({
    'any.required': 'Loại kết nối là bắt buộc',
    'any.only': 'Loại kết nối không hợp lệ'
  }),
  connection: Joi.when('type', {
    is: ConnectPrint.NETWORK,
    then: networkConnectionSchema,
    otherwise: connectionSchema
  }),
  location: Joi.string().trim().max(255).allow('', null),
  isActive: Joi.boolean().default(true),
  isDefault: Joi.boolean().default(false),
  services: Joi.array().items(objectId).default([])
});

const updatePrinterSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).messages({
    'string.empty': 'Tên máy in không được để trống',
    'string.min': 'Tên máy in phải có ít nhất 2 ký tự',
    'string.max': 'Tên máy in không được vượt quá 100 ký tự'
  }),
  code: Joi.string().trim().uppercase().min(2).max(50).pattern(/^[A-Z0-9_-]+$/).messages({
    'string.empty': 'Mã máy in không được để trống',
    'string.min': 'Mã máy in phải có ít nhất 2 ký tự',
    'string.max': 'Mã máy in không được vượt quá 50 ký tự',
    'string.pattern.base': 'Mã máy in chỉ được chứa chữ hoa, số, dấu gạch ngang và gạch dưới'
  }),
  type: Joi.string().valid(...Object.values(ConnectPrint)),
  connection: connectionSchema,
  location: Joi.string().trim().max(255).allow('', null),
  isActive: Joi.boolean(),
  isDefault: Joi.boolean(),
  services: Joi.array().items(objectId)
})
  .min(1)
  .custom((value, helpers) => {
    if (value.type === ConnectPrint.NETWORK || (!value.type && value.connection?.host)) {
      const { error } = networkConnectionSchema.validate(value.connection || {});
      if (error) {
        return helpers.error('any.invalid', { message: error.details[0].message });
      }
    }

    return value;
  })
  .messages({
    'any.invalid': '{{#message}}'
  });

const printTicketSchema = Joi.object({
  printerCode: Joi.string().trim().required().messages({
    'any.required': 'printerCode là bắt buộc',
    'string.empty': 'printerCode không được để trống'
  }),
  ticketId: objectId.required().messages({
    'any.required': 'ticketId là bắt buộc'
  })
});

module.exports = {
  printerCodeParamSchema,
  printerIdParamSchema: idParamSchema,
  createPrinterSchema,
  updatePrinterSchema,
  printTicketSchema
};
