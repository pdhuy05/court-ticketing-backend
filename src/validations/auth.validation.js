const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(50)
    .required()
    .messages({
      'any.required': 'Tên đăng nhập là bắt buộc',
      'string.empty': 'Tên đăng nhập không được để trống',
      'string.min': 'Tên đăng nhập phải có ít nhất 3 ký tự',
      'string.max': 'Tên đăng nhập không được vượt quá 50 ký tự'
    }),
  password: Joi.string()
    .max(100)
    .required()
    .messages({
      'any.required': 'Mật khẩu là bắt buộc',
      'string.empty': 'Mật khẩu không được để trống',
      'string.max': 'Mật khẩu không được vượt quá 100 ký tự'
    })
});

const updateProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional().messages({
    'string.min': 'Họ và tên phải có ít nhất 2 ký tự',
    'string.max': 'Họ và tên không được vượt quá 100 ký tự'
  }),
  email: Joi.string().trim().email().allow('', null).optional().messages({
    'string.email': 'Email không hợp lệ'
  }),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]{7,20}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Số điện thoại không hợp lệ'
  }),
  address: Joi.string().trim().max(200).allow('', null).optional().messages({
    'string.max': 'Địa chỉ không được vượt quá 200 ký tự'
  }),
  currentPassword: Joi.string().max(100).optional().allow('', null),
  newPassword: Joi.string().min(6).max(100).optional().allow('', null).messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự'
  }),
});

module.exports = {
  loginSchema,
  updateProfileSchema,
};