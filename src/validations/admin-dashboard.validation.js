const Joi = require('joi');

const overviewQuerySchema = Joi.object({
  overloadThreshold: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Ngưỡng quá tải phải là số',
      'number.min': 'Ngưỡng quá tải phải lớn hơn 0'
    })
});

const reportQuerySchema = Joi.object({
  period: Joi.string()
    .valid('daily', 'monthly')
    .default('daily')
    .messages({
      'any.only': 'period chỉ được là daily hoặc monthly'
    }),
  date: Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'date phải có định dạng YYYY-MM-DD'
    }),
  month: Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'month phải có định dạng YYYY-MM'
    }),
  overloadThreshold: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Ngưỡng quá tải phải là số',
      'number.min': 'Ngưỡng quá tải phải lớn hơn 0'
    })
}).custom((value, helpers) => {
  if (value.period === 'daily' && value.month) {
    return helpers.error('any.invalid', {
      message: 'Báo cáo daily không sử dụng tham số month'
    });
  }

  if (value.period === 'monthly' && value.date) {
    return helpers.error('any.invalid', {
      message: 'Báo cáo monthly không sử dụng tham số date'
    });
  }

  return value;
}).messages({
  'any.invalid': '{{#message}}'
});

module.exports = {
  overviewQuerySchema,
  reportQuerySchema
};
