const aiService = require("../services/ai.service");
const asyncHandler = require("../utils/asyncHandler");
const { log, AUDIT_ACTIONS } = require("../services/audit.service");

exports.chat = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  const result = await aiService.askAssistant({ message, history });

  res.json({
    success: true,
    data: result,
  });
});

exports.getKnowledge = asyncHandler(async (req, res) => {
  const knowledge = await aiService.getKnowledge();
  const isDefault = !knowledge?.trim();

  res.json({
    success: true,
    data: {
      knowledge: isDefault ? aiService.DEFAULT_KNOWLEDGE : knowledge,
      isDefault,
    },
  });
});

exports.updateKnowledge = asyncHandler(async (req, res) => {
  const { knowledge } = req.body;
  const saved = await aiService.setKnowledge(knowledge);

  log({
    req,
    action: AUDIT_ACTIONS.AI_KNOWLEDGE_UPDATE,
    detail: { length: saved.length },
  }).catch(() => {});

  res.json({
    success: true,
    data: { knowledge: saved },
  });
});