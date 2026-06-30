const express = require("express");
const router = express.Router();
const AiController = require("../controllers/ai.controller");
const validate = require("../middlewares/validate.middleware");
const { askAssistantSchema, updateKnowledgeSchema } = require("../validations/ai.validation");
const { aiChatLimiter } = require("../middlewares/rate-limit.middleware");
const { authMiddleware, superAdminOnly } = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.post("/chat", aiChatLimiter, validate(askAssistantSchema), AiController.chat);

router.get("/knowledge", superAdminOnly, AiController.getKnowledge);
router.put("/knowledge", superAdminOnly, validate(updateKnowledgeSchema), AiController.updateKnowledge);

module.exports = router;