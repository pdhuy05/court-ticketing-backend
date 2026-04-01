const Joi = require('joi');

const createCounterSchema = Joi.object({
  code: Joi.string()
    .required()
    .uppercase()
    .trim()
    .max(50)
    .messages({
      'any.required': 'Mã quầy không được để trống',
      'string.empty': 'Mã quầy không được để trống',
      'string.max': 'Mã quầy không được vượt quá 50 ký tự'
    }),
  name: Joi.string()
    .required()
    .trim()
    .max(100)
    .messages({
      'any.required': 'Tên quầy không được để trống',
      'string.empty': 'Tên quầy không được để trống',
      'string.max': 'Tên quầy không được vượt quá 100 ký tự'
    }),
  number: Joi.number()
    .required()
    .integer()
    .min(1)
    .messages({
      'any.required': 'Số quầy là bắt buộc',
      'number.min': 'Số quầy phải lớn hơn 0'
    }),
  serviceIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .required()
    .unique()
    .messages({
      'array.min': 'Phải chọn ít nhất một dịch vụ',
      'any.required': 'Danh sách dịch vụ là bắt buộc',
      'string.pattern.base': 'ID dịch vụ không hợp lệ'
    }),
  note: Joi.string()
    .allow('', null)
    .default(''),
  isActive: Joi.boolean()
    .default(true)
});

const updateCounterSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  number: Joi.number().integer().min(1).optional(),
  note: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().optional()
}).min(1);

const addServicesSchema = Joi.object({
  serviceIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .required()
    .messages({
      'array.min': 'Phải chọn ít nhất một dịch vụ',
      'any.required': 'Danh sách dịch vụ là bắt buộc',
      'string.pattern.base': 'ID dịch vụ không hợp lệ'
    })
});

module.exports = {
  createCounterSchema,
  updateCounterSchema,
  addServicesSchema
};