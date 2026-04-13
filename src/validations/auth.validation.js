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

module.exports = {
  loginSchema
};
