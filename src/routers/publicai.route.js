const express = require("express");
const router = express.Router();
const PublicAiController = require("../controllers/publicAi.controller");
const validate = require("../middlewares/validate.middleware");
const {
  askPublicAssistantSchema,
  updatePublicKnowledgeSchema,
} = require("../validations/publicAi.validation");
const { publicAiChatLimiter } = require("../middlewares/rate-limit.middleware");
const { authMiddleware, superAdminOnly } = require("../middlewares/auth.middleware");

router.post("/chat", publicAiChatLimiter, validate(askPublicAssistantSchema), PublicAiController.chat);
router.get("/topics", PublicAiController.getTopics);
router.get("/knowledge", authMiddleware, superAdminOnly, PublicAiController.getKnowledge);
router.put(
  "/knowledge",
  authMiddleware,
  superAdminOnly,
  validate(updatePublicKnowledgeSchema),
  PublicAiController.updateKnowledge,
);

module.exports = router;