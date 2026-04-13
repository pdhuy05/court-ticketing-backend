const Joi = require('joi');

const objectId = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.empty': 'ID không được để trống',
    'string.pattern.base': 'ID không hợp lệ'
  });

const idParamSchema = Joi.object({
  id: objectId.required().messages({
    'any.required': 'ID là bắt buộc'
  })
});

module.exports = {
  objectId,
  idParamSchema
};
