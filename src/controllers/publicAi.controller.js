const publicAiService = require("../services/publicAi.service");
const asyncHandler = require("../utils/asyncHandler");
const { log, AUDIT_ACTIONS } = require("../services/audit.service");

exports.chat = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  const result = await publicAiService.askAssistant({ message, history });

  res.json({
    success: true,
    data: result,
  });
});

exports.getKnowledge = asyncHandler(async (req, res) => {
  const knowledge = await publicAiService.getKnowledge();
  const isDefault = !knowledge?.trim();

  res.json({
    success: true,
    data: {
      knowledge: isDefault ? publicAiService.DEFAULT_KNOWLEDGE : knowledge,
      isDefault,
    },
  });
});

exports.getTopics = asyncHandler(async (req, res) => {
  const topics = await publicAiService.getTopics();

  res.json({
    success: true,
    data: { topics },
  });
});

exports.updateKnowledge = asyncHandler(async (req, res) => {
  const { knowledge } = req.body;
  const saved = await publicAiService.setKnowledge(knowledge);

  log({
    req,
    action: AUDIT_ACTIONS.AI_KNOWLEDGE_UPDATE,
    detail: { length: saved.length, scope: "public" },
  }).catch(() => {});

  res.json({
    success: true,
    data: { knowledge: saved },
  });
});