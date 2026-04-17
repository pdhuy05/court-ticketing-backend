const Joi = require('joi');
const { idParamSchema, objectId } = require('./common.validation');

const createTicketSchema = Joi.object({
    serviceId: Joi.string()
        .trim()
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
        .trim()
        .pattern(/^[0-9]{10}$/)
        .messages({
            'any.required': 'Số điện thoại là bắt buộc',
            'string.empty': 'Số điện thoại không được để trống',
            'string.pattern.base': 'Số điện thoại phải gồm đúng 10 chữ số'
        }),
    counterId: objectId.optional(),
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

const callByIdSchema = Joi.object({
    ticketId: objectId.required().messages({
        'any.required': 'ticketId là bắt buộc'
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
    ticketIdParamSchema: idParamSchema,
    counterDisplayParamsSchema: Joi.object({
        counterId: objectId.required().messages({
            'any.required': 'ID quầy là bắt buộc'
        })
    }),
    createTicketSchema,
    callNextSchema,
    callByIdSchema,
    completeTicketSchema,
    cancelTicketSchema,
    skipTicketSchema,
    recallTicketParamsSchema: idParamSchema,
    cancelRecallTicketSchema: Joi.object({
        reason: Joi.string().trim().max(500).optional()
    })
};
