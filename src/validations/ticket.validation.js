const Joi = require('joi');

const createTicketSchema = Joi.object({
  serviceId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'any.required': 'Vui lòng chọn dịch vụ',
      'string.pattern.base': 'ID dịch vụ không hợp lệ'
    }),
  name: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'any.required': 'Tên khách hàng là bắt buộc',
      'string.empty': 'Tên khách hàng không được để trống',
      'string.min': 'Tên khách hàng phải có ít nhất 2 ký tự',
      'string.max': 'Tên khách hàng không được vượt quá 100 ký tự'
    }),
  phone: Joi.string()
    .required()
    .pattern(/^(03|05|07|08|09|01[2|6|8|9])[0-9]{7,8}$/)
    .min(10)
    .max(11)
    .messages({
      'any.required': 'Số điện thoại là bắt buộc',
      'string.pattern.base': 'Số điện thoại không hợp lệ (VD: 0912345678)',
      'string.min': 'Số điện thoại phải có 10-11 số',
      'string.max': 'Số điện thoại phải có 10-11 số'
    }),
  autoPrint: Joi.boolean().default(true)
});

const callNextSchema = Joi.object({
  counterId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'any.required': 'Vui lòng chọn quầy',
      'string.pattern.base': 'ID quầy không hợp lệ'
    })
});

const completeTicketSchema = Joi.object({}).optional();

const cancelTicketSchema = Joi.object({
  reason: Joi.string().optional().max(500)
});

const skipTicketSchema = Joi.object({
  reason: Joi.string().optional().max(500)
});

module.exports = {
  createTicketSchema,
  callNextSchema,
  completeTicketSchema,
  cancelTicketSchema,
  skipTicketSchema
};