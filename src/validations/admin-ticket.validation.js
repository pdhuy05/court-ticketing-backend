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

const searchTicketsSchema = Joi.object({
  phone: Joi.string().trim().min(4).max(15).optional()
    .messages({ 'string.min': 'Số điện thoại phải có ít nhất 4 ký tự' }),

  name: Joi.string().trim().min(2).max(50).optional()
    .messages({ 'string.min': 'Tên phải có ít nhất 2 ký tự' }),

  ticketNumber: Joi.string().trim().min(1).max(20).optional(),

  date: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
    .messages({ 'string.pattern.base': 'Ngày phải có định dạng YYYY-MM-DD' }),

  dateFrom: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
    .messages({ 'string.pattern.base': 'Ngày bắt đầu phải có định dạng YYYY-MM-DD' }),
  dateTo: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
    .messages({ 'string.pattern.base': 'Ngày kết thúc phải có định dạng YYYY-MM-DD' }),

  status: Joi.string().valid('waiting', 'processing', 'completed', 'skipped').optional(),

  serviceId: Joi.string().hex().length(24).optional(),

  counterId: Joi.string().hex().length(24).optional(),

  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).or('phone', 'name', 'ticketNumber', 'date', 'dateFrom', 'dateTo', 'status', 'serviceId', 'counterId')
  .messages({
    'object.missing': 'Vui lòng nhập ít nhất một tiêu chí tìm kiếm'
  });

module.exports = {
  resetTicketsByDateSchema,
  searchTicketsSchema,
};