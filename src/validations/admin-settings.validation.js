const Joi = require('joi');

const patchTtsEnabledSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Trường enabled là bắt buộc (true = bật TTS, false = tắt TTS)',
      'boolean.base': 'enabled phải là true hoặc false'
    })
});

module.exports = {
  patchTtsEnabledSchema
};
