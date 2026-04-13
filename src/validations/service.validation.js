const Joi = require('joi');
const { idParamSchema, objectId } = require('./common.validation');

const createServiceSchema = Joi.object({
    code: Joi.string()
        .required()
        .uppercase()
        .trim()
        .pattern(/^[A-Z]{2,6}$/)
        .messages({
            'any.required': 'Mã dịch vụ không được để trống',
            'string.empty': 'Mã dịch vụ không được để trống',
            'string.pattern.base': 'Mã dịch vụ phải gồm 2-5 chữ cái in hoa'
        }),
    name: Joi.string()
        .required()
        .trim()
        .min(2)
        .max(100)
        .messages({
            'any.required': 'Tên dịch vụ không được để trống',
            'string.empty': 'Tên dịch vụ không được để trống',
            'string.min': 'Tên dịch vụ phải có ít nhất 2 ký tự',
            'string.max': 'Tên dịch vụ không được quá 100 ký tự'
        }),
    icon: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    displayOrder: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .optional(),
    isActive: Joi.boolean().default(true)
});

const updateServiceSchema = Joi.object({
    code: Joi.string()
        .optional()
        .uppercase()
        .trim()
        .pattern(/^[A-Z0-9]{2,5}$/)
        .messages({
            'string.pattern.base': 'Mã dịch vụ phải gồm 2-5 chữ cái in hoa'
        }),
    name: Joi.string()
        .optional()
        .trim()
        .min(2)
        .max(100),
    icon: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    displayOrder: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
}).min(1);

const addCountersSchema = Joi.object({
    counterIds: Joi.array()
        .items(objectId)
        .min(1)
        .required()
        .messages({
            'array.min': 'Phải chọn ít nhất một quầy',
            'array.base': 'counterIds phải là một mảng',
            'any.required': 'Danh sách quầy là bắt buộc',
            'string.pattern.base': 'ID quầy không hợp lệ'
        })
});

module.exports = {
    serviceIdParamSchema: idParamSchema,
    serviceCounterParamsSchema: Joi.object({
        id: objectId.required().messages({
            'any.required': 'ID dịch vụ là bắt buộc'
        }),
        counterId: objectId.required().messages({
            'any.required': 'ID quầy là bắt buộc'
        })
    }),
    createServiceSchema,
    updateServiceSchema,
    addCountersSchema
};
