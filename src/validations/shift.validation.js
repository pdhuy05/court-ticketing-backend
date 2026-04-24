const Joi = require('joi');

const endShiftSchema = Joi.object({
  reason: Joi.string().max(500).allow('').default('')
});

const patchSelfManageEnabledSchema = Joi.object({
  enabled: Joi.boolean().required()
});

const patchAutoStartTimeSchema = Joi.object({
  time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Thời gian phải theo định dạng HH:MM'
    })
});

const patchReminderMinutesSchema = Joi.object({
  minutes: Joi.number().integer().min(0).max(120).required()
});

const adminEndShiftSchema = Joi.object({
  reason: Joi.string().max(500).allow('').default('Admin kết thúc ca thủ công')
});

module.exports = {
  endShiftSchema,
  patchSelfManageEnabledSchema,
  patchAutoStartTimeSchema,
  patchReminderMinutesSchema,
  adminEndShiftSchema
};
