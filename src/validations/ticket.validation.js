const Joi = require('joi');
const { Gender } = require('../constants/enums');

const createTicketSchema = Joi.object({
    serviceId: Joi.string().required().messages({
        'any.required': 'serviceId là bắt buộc',
        'string.empty': 'serviceId không được rỗng'
    }),
    name: Joi.string().trim().required().messages({
        'any.required': 'Tên không được để trống'
    }),
    gender: Joi.string().valid(
        Gender.MALE,   
        Gender.FEMALE,  
        Gender.OTHER  
    ).default(Gender.OTHER).optional(),  
    phone: Joi.string().pattern(/^0[0-9]{9,10}$/).required().messages({
        'string.pattern.base': 'Số điện thoại không hợp lệ (phải bắt đầu bằng 0 và có 10-11 số)',
        'any.required': 'Số điện thoại là bắt buộc'
    })
});

const callNextSchema = Joi.object({
    counterId: Joi.string().required().messages({
        'any.required': 'counterId là bắt buộc'
    })
});

const idParamSchema = Joi.object({
    id: Joi.string().required()
});

const counterParamSchema = Joi.object({
    counterId: Joi.string().required()
});

module.exports = {
    createTicketSchema,
    callNextSchema,
    idParamSchema,
    counterParamSchema
};