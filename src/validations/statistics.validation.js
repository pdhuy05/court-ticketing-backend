const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dailyStatisticsQuerySchema = Joi.object({
  date: Joi.string()
    .trim()
    .pattern(datePattern)
    .required()
    .messages({
      'any.required': 'Tham số date là bắt buộc',
      'string.pattern.base': 'date phải có định dạng YYYY-MM-DD'
    })
});

const statisticsRangeQuerySchema = Joi.object({
  startDate: Joi.string()
    .trim()
    .pattern(datePattern)
    .required()
    .messages({
      'any.required': 'Tham số startDate là bắt buộc',
      'string.pattern.base': 'startDate phải có định dạng YYYY-MM-DD'
    }),
  endDate: Joi.string()
    .trim()
    .pattern(datePattern)
    .required()
    .messages({
      'any.required': 'Tham số endDate là bắt buộc',
      'string.pattern.base': 'endDate phải có định dạng YYYY-MM-DD'
    })
});

module.exports = {
  dailyStatisticsQuerySchema,
  statisticsRangeQuerySchema
};
