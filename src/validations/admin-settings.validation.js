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

module.exports = {
  patchAutoResetEnabledSchema,
  patchAutoResetTimeSchema,
  patchTtsEnabledSchema
};
