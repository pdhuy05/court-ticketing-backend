const Joi = require('joi');

const patchTtsEnabledSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Trường enabled là bắt buộc (true = bật TTS, false = tắt TTS)',
      'boolean.base': 'enabled phải là true hoặc false'
    })
});

const patchAutoResetEnabledSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Trường enabled là bắt buộc',
      'boolean.base': 'enabled phải là true hoặc false'
    })
});

const patchAutoResetTimeSchema = Joi.object({
  time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required()
    .messages({
      'any.required': 'Trường time là bắt buộc',
      'string.empty': 'Trường time không được để trống',
      'string.pattern.base': 'time phải có định dạng HH:MM'
    })
});

const patchSiteConfigSchema = Joi.object({
  branchName: Joi.string().trim().min(1).max(200).messages({
    'string.min': 'Tên đơn vị không được để trống',
    'string.max': 'Tên đơn vị không được vượt quá 200 ký tự',
  }),
  logoUrl: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'URL logo không được vượt quá 500 ký tự',
  }),
  primaryColor: Joi.string().trim().pattern(/^#[0-9A-Fa-f]{6}$/).messages({
    'string.pattern.base': 'Màu chủ đạo phải theo định dạng HEX, ví dụ: #1a3c6e',
  }),
  tickerText: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'Văn bản ticker không được vượt quá 500 ký tự',
  }),
  workingHours: Joi.string().trim().max(100).allow('').messages({
    'string.max': 'Giờ làm việc không được vượt quá 100 ký tự',
  }),
  address: Joi.string().trim().max(300).allow('').messages({
    'string.max': 'Địa chỉ không được vượt quá 300 ký tự',
  }),
  announcement: Joi.string().trim().max(1000).allow('').messages({
    'string.max': 'Thông báo không được vượt quá 1000 ký tự',
  }),
}).min(1).messages({
  'object.min': 'Cần cung cấp ít nhất một trường để cập nhật',
});

module.exports = {
  patchAutoResetEnabledSchema,
  patchAutoResetTimeSchema,
  patchTtsEnabledSchema,
  patchSiteConfigSchema,
  patchDisplayModeSchema: Joi.object({
    mode: Joi.string()
      .valid('service', 'queue')
      .required()
      .messages({
        'any.required': "Trường mode là bắt buộc",
        'any.only': "mode phải là 'service' hoặc 'queue'",
      }),
  }),
};