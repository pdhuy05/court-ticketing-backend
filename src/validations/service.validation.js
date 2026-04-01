const Joi = require('joi');

const createServiceSchema = Joi.object({
    code: Joi.string().required().uppercase().trim().messages({
        'any.required': 'Mã dịch vụ không được để trống',
        'string.empty': 'Mã dịch vụ không được để trống'
    }),
    name: Joi.string().required().trim().messages({
        'any.required': 'Tên dịch vụ không được để trống',
        'string.empty': 'Tên dịch vụ không được để trống'
    }),
    icon: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    displayOrder: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true)
});

const updateServiceSchema = Joi.object({
    name: Joi.string().optional().trim(),
    icon: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    displayOrder: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
}).min(1);

const addCountersSchema = Joi.object({
    counterIds: Joi.array()
        .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
        .min(1)
        .required()
        .messages({
            'array.min': 'Phải chọn ít nhất một quầy',
            'array.base': 'counterIds phải là một mảng',
            'any.required': 'Danh sách quầy là bắt buộc',
            'string.pattern.base': 'ID quầy không hợp lệ'
        })
});

module.exports = { createServiceSchema, updateServiceSchema, addCountersSchema };