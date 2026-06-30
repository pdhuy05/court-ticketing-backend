const Joi = require("joi");

const historyItemSchema = Joi.object({
  role: Joi.string().valid("user", "assistant").required(),
  content: Joi.string().trim().min(1).max(2000).required(),
});

const askAssistantSchema = Joi.object({
  message: Joi.string().trim().min(1).max(1000).required().messages({
    "any.required": "Vui lòng nhập câu hỏi",
    "string.empty": "Vui lòng nhập câu hỏi",
    "string.max": "Câu hỏi không được quá 1000 ký tự",
  }),
  history: Joi.array().items(historyItemSchema).max(10).default([]),
});

const updateKnowledgeSchema = Joi.object({
  knowledge: Joi.string().trim().max(50000).allow("").required().messages({
    "string.max": "Nội dung huấn luyện không được quá 50000 ký tự",
  }),
});

module.exports = { askAssistantSchema, updateKnowledgeSchema };