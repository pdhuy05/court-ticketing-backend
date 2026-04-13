const Joi = require('joi');
const { idParamSchema, objectId } = require('./common.validation');

const createStaffSchema = Joi.object({
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(50)
    .required()
    .messages({
      'any.required': 'Tên đăng nhập là bắt buộc',
      'string.empty': 'Tên đăng nhập không được để trống'
    }),
  password: Joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      'any.required': 'Mật khẩu là bắt buộc',
      'string.empty': 'Mật khẩu không được để trống'
    }),
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'any.required': 'Họ tên là bắt buộc',
      'string.empty': 'Họ tên không được để trống'
    }),
  counterId: objectId.allow(null, '')
});

const updateStaffSchema = Joi.object({
  password: Joi.string().min(6).max(100),
  fullName: Joi.string().trim().min(2).max(100),
  counterId: objectId.allow(null, ''),
  isActive: Joi.boolean()
}).min(1);

const assignCounterSchema = Joi.object({
  counterId: objectId.required().messages({
    'any.required': 'counterId là bắt buộc'
  })
});

module.exports = {
  staffIdParamSchema: idParamSchema,
  createStaffSchema,
  updateStaffSchema,
  assignCounterSchema
};
