const Joi = require('joi');

const patchAutoStartTimeSchema = Joi.object({
  time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required()
    .messages({ 'string.pattern.base': 'Thời gian phải theo định dạng HH:MM' })
});

const patchReminderMinutesSchema = Joi.object({
  minutes: Joi.number().integer().min(0).max(120).required()
});

const adminEndShiftSchema = Joi.object({
  reason: Joi.string().max(500).allow('').default('Admin kết thúc ca thủ công')
});

const timeSlotSchema = Joi.object({
  openTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required()
    .messages({ 'string.pattern.base': 'Giờ mở phải theo định dạng HH:MM' }),
  closeTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required()
    .messages({ 'string.pattern.base': 'Giờ đóng phải theo định dạng HH:MM' }),
});

const upsertServiceScheduleSchema = Joi.object({
  serviceId: Joi.alternatives().try(
    Joi.string().valid('ALL'),
    Joi.string().pattern(/^[a-f\d]{24}$/i)
  ).required(),
  // New: array of slots
  slots: Joi.array().items(timeSlotSchema).min(1).max(10).optional(),
  // Legacy single slot (kept for backward compat)
  openTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  closeTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  isEnabled: Joi.boolean().default(true)
}).or('slots', 'openTime'); // require at least one

const toggleScheduleSchema = Joi.object({
  isEnabled: Joi.boolean().required()
});

const manualOverrideSchema = Joi.object({
  override: Joi.string().valid('open', 'closed', null).required()
});

module.exports = {
  patchAutoStartTimeSchema,
  patchReminderMinutesSchema,
  adminEndShiftSchema,
  upsertServiceScheduleSchema,
  toggleScheduleSchema,
  manualOverrideSchema,
};