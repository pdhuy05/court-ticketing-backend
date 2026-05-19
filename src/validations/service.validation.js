const Joi = require("joi");
const { idParamSchema, objectId } = require("./common.validation");

const createServiceSchema = Joi.object({
  code: Joi.string()
    .required()
    .uppercase()
    .trim()
    .pattern(/^[A-Z]{2,6}$/)
    .messages({
      "any.required": "Mã quầy không được để trống",
      "string.empty": "Mã quầy không được để trống",
      "string.pattern.base": "Mã quầy phải gồm 2-5 chữ cái in hoa",
    }),
  name: Joi.string().required().trim().min(2).max(100).messages({
    "any.required": "Tên quầy không được để trống",
    "string.empty": "Tên quầy không được để trống",
    "string.min": "Tên quầy phải có ít nhất 2 ký tự",
    "string.max": "Tên quầy không được quá 100 ký tự",
  }),
  icon: Joi.string().optional().allow(""),
  description: Joi.string().optional().allow(""),
  displayOrder: Joi.number().integer().min(0).default(0).optional(),
  isActive: Joi.boolean().default(true),
  prefixNumber: Joi.number()
    .integer()
    .min(0)
    .max(99)
    .default(0)
    .optional()
    .messages({
      "number.base": "prefixNumber phải là số",
      "number.min": "prefixNumber tối thiểu là 0",
      "number.max": "prefixNumber tối đa là 99",
    }),
  doublePrint: Joi.boolean().default(false).optional(),
  inactiveLabel: Joi.string().optional().allow("").max(40).trim(),
});

const updateServiceSchema = Joi.object({
  code: Joi.string()
    .optional()
    .uppercase()
    .trim()
    .pattern(/^[A-Z0-9]{2,5}$/)
    .messages({
      "string.pattern.base": "Mã quầy phải gồm 2-5 chữ cái in hoa",
    }),
  name: Joi.string().optional().trim().min(2).max(100),
  icon: Joi.string().optional().allow(""),
  description: Joi.string().optional().allow(""),
  displayOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  prefixNumber: Joi.number().integer().min(0).max(99).optional().messages({
    "number.base": "prefixNumber phải là số",
    "number.min": "prefixNumber tối thiểu là 0",
    "number.max": "prefixNumber tối đa là 99",
  }),
  doublePrint: Joi.boolean().optional(),
  inactiveLabel: Joi.string().optional().allow("").max(40).trim(),
}).min(1);

const toggleDoublePrintSchema = Joi.object({
  doublePrint: Joi.boolean().required().messages({
    "any.required": "doublePrint là bắt buộc",
    "boolean.base": "doublePrint phải là true hoặc false",
  }),
});

const addCountersSchema = Joi.object({
  counterIds: Joi.array().items(objectId).min(1).required().messages({
    "array.min": "Phải chọn ít nhất một phòng",
    "array.base": "counterIds phải là một mảng",
    "any.required": "Danh sách phòng là bắt buộc",
    "string.pattern.base": "ID phòng không hợp lệ",
  }),
});

module.exports = {
  serviceIdParamSchema: idParamSchema,
  serviceCounterParamsSchema: Joi.object({
    id: objectId.required().messages({
      "any.required": "ID quầy là bắt buộc",
    }),
    counterId: objectId.required().messages({
      "any.required": "ID phòng là bắt buộc",
    }),
  }),
  createServiceSchema,
  updateServiceSchema,
  addCountersSchema,
  toggleDoublePrintSchema,
};