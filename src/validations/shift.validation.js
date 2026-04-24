const Joi = require('joi');

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

const upsertServiceScheduleSchema = Joi.object({
  serviceId: Joi.alternatives().try(
    Joi.string().valid('ALL'),
    Joi.string().pattern(/^[a-f\d]{24}$/i)
  ).required(),
  openTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required(),
  closeTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required(),
  isEnabled: Joi.boolean().default(true)
});

const toggleScheduleSchema = Joi.object({
  isEnabled: Joi.boolean().required()
});

module.exports = {
  patchAutoStartTimeSchema,
  patchReminderMinutesSchema,
  adminEndShiftSchema,
  upsertServiceScheduleSchema,
  toggleScheduleSchema
};
