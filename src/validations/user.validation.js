const Joi = require('joi');
const { idParamSchema, objectId } = require('./common.validation');

const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@!#$%^&*])[A-Za-z\d@!#$%^&*]{8,64}$/;
const WEAK_PASSWORD_PATTERNS = ['123456', 'password'];

const validatePasswordStrength = (value, helpers) => {
  const username = String(helpers.state.ancestors?.[0]?.username || '').toLowerCase();
  const normalizedPassword = String(value).toLowerCase();

  if (username && normalizedPassword.includes(username)) {
    return helpers.error('password.containsUsername');
  }

  if (WEAK_PASSWORD_PATTERNS.some((pattern) => normalizedPassword.includes(pattern))) {
    return helpers.error('password.tooWeak');
  }

  return value;
};

const createStaffSchema = Joi.object({
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(30)
    .pattern(USERNAME_PATTERN)
    .required()
    .messages({
      'any.required': 'Tên đăng nhập là bắt buộc',
      'string.empty': 'Tên đăng nhập không được để trống',
      'string.min': 'Tên đăng nhập phải có ít nhất 3 ký tự',
      'string.max': 'Tên đăng nhập không được vượt quá 30 ký tự',
      'string.pattern.base': 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu chấm và gạch dưới'
    }),
  password: Joi.string()
    .trim()
    .min(8)
    .max(64)
    .pattern(PASSWORD_PATTERN)
    .custom(validatePasswordStrength)
    .required()
    .messages({
      'any.required': 'Mật khẩu là bắt buộc',
      'string.empty': 'Mật khẩu không được để trống',
      'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu không được vượt quá 64 ký tự',
      'string.pattern.base': 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt (@, !, #, $, %, ^, &, *)',
      'password.containsUsername': 'Mật khẩu không được chứa tên đăng nhập',
      'password.tooWeak': 'Mật khẩu quá yếu, không được chứa các chuỗi dễ đoán như "123456" hoặc "password"'
    }),
  fullName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'any.required': 'Họ tên là bắt buộc',
      'string.empty': 'Họ tên không được để trống',
      'string.min': 'Họ tên phải có ít nhất 2 ký tự',
      'string.max': 'Họ tên không được vượt quá 100 ký tự'
    }),
  counterId: objectId.allow(null, '')
});

const updateStaffSchema = Joi.object({
  password: Joi.string().trim().min(8).max(64).pattern(PASSWORD_PATTERN).messages({
    'string.empty': 'Mật khẩu không được để trống',
    'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
    'string.max': 'Mật khẩu không được vượt quá 64 ký tự',
    'string.pattern.base': 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt (@, !, #, $, %, ^, &, *)'
  }),
  fullName: Joi.string().trim().min(2).max(100).messages({
    'string.empty': 'Họ tên không được để trống',
    'string.min': 'Họ tên phải có ít nhất 2 ký tự',
    'string.max': 'Họ tên không được vượt quá 100 ký tự'
  }),
  counterId: objectId.allow(null, ''),
  isActive: Joi.boolean()
}).min(1).messages({
  'object.min': 'Vui lòng nhập ít nhất 1 trường cần cập nhật'
});

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
