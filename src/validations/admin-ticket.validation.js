const Joi = require('joi');

const resetTicketsByDateSchema = Joi.object({
  date: Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Ngày phải có định dạng YYYY-MM-DD'
    })
});

module.exports = {
  resetTicketsByDateSchema
};
