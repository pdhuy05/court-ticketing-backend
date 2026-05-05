const Joi = require("joi");
const { idParamSchema, objectId } = require("./common.validation");

const optionalServiceIdsSchema = Joi.alternatives()
  .try(
    Joi.array()
      .items(Joi.alternatives().try(objectId, Joi.valid(""), Joi.valid(null)))
      .custom((value, helpers) => {
        const normalized = value.filter(Boolean);
        if (new Set(normalized).size !== normalized.length) {
          return helpers.error("array.unique");
        }
        return normalized;
      }),
    Joi.valid(null),
    Joi.string().trim().valid(""),
  )
  .optional()
  .custom((value) => {
    if (value === null || value === "") {
      return [];
    }

    return value;
  })
  .messages({
    "string.pattern.base": "ID quầy không hợp lệ",
    "array.unique": "Danh sách quầy bị trùng",
  });

const createCounterSchema = Joi.object({
  code: Joi.string().required().uppercase().trim().max(50).messages({
    "any.required": "Mã phòng không được để trống",
    "string.empty": "Mã phòng không được để trống",
    "string.max": "Mã phòng không được vượt quá 50 ký tự",
  }),
  name: Joi.string().required().trim().max(100).messages({
    "any.required": "Tên phòng không được để trống",
    "string.empty": "Tên phòng không được để trống",
    "string.max": "Tên phòng không được vượt quá 100 ký tự",
  }),
  number: Joi.number().required().integer().min(1).messages({
    "any.required": "Số phòng là bắt buộc",
    "number.min": "Số phòng phải lớn hơn 0",
  }),
  serviceIds: optionalServiceIdsSchema,
  note: Joi.string().allow("", null).default(""),
  isActive: Joi.boolean().default(true),
});

const updateCounterSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  number: Joi.number().integer().min(1).optional(),
  note: Joi.string().allow("", null).optional(),
  isActive: Joi.boolean().optional(),
  serviceIds: optionalServiceIdsSchema,
}).min(1);

const addServicesSchema = Joi.object({
  serviceIds: Joi.array().items(objectId).min(1).required().messages({
    "array.min": "Phải chọn ít nhất một quầy",
    "any.required": "Danh sách quầy là bắt buộc",
    "string.pattern.base": "ID quầy không hợp lệ",
  }),
});

module.exports = {
  counterIdParamSchema: idParamSchema,
  counterServiceParamsSchema: Joi.object({
    id: objectId.required().messages({
      "any.required": "ID phòng là bắt buộc",
    }),
    serviceId: objectId.required().messages({
      "any.required": "ID quầy là bắt buộc",
    }),
  }),
  createCounterSchema,
  updateCounterSchema,
  addServicesSchema,
};
