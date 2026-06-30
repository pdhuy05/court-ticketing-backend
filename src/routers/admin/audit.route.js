const { getLogs } = require("../../services/audit.service");
const asyncHandler = require("../../utils/asyncHandler");
const express = require("express");
const router = express.Router();
const { authMiddleware, adminOnly, requirePermission } = require("../../middlewares/auth.middleware");

const getAuditLogs = async (req, res) => {
  const {
    actorId,
    actorUsername,
    action,
    status,
    dateFrom,
    dateTo,
    page  = 1,
    limit = 50,
  } = req.query;

  const result = await getLogs({
    actorId, actorUsername, action, status, dateFrom, dateTo,
    page:  Number(page),
    limit: Math.min(Number(limit), 200),
  });

  res.json({ success: true, data: result });
};

router.get("/", authMiddleware, requirePermission("audit-logs"), asyncHandler(getAuditLogs));

module.exports = router;