const AuditLog = require("../models/auditLog.model");
const { calcExpiresAt } = require("../models/auditLog.model");

const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS:        "LOGIN_SUCCESS",
  LOGIN_FAILED:         "LOGIN_FAILED",
  LOGOUT:               "LOGOUT",
  PASSWORD_CHANGED:     "PASSWORD_CHANGED",

  // Ticket
  TICKET_RESET_DAY:     "TICKET_RESET_DAY",
  TICKET_RESET_ALL:     "TICKET_RESET_ALL",
  TICKET_AUTO_RESET:    "TICKET_AUTO_RESET",

  // Service
  SERVICE_CREATE:       "SERVICE_CREATE",
  SERVICE_UPDATE:       "SERVICE_UPDATE",
  SERVICE_DELETE:       "SERVICE_DELETE",
  SERVICE_TOGGLE:       "SERVICE_TOGGLE",
  SERVICE_COUNTER_ADD:    "SERVICE_COUNTER_ADD",
  SERVICE_COUNTER_REMOVE: "SERVICE_COUNTER_REMOVE",

  // Counter
  COUNTER_CREATE:       "COUNTER_CREATE",
  COUNTER_UPDATE:       "COUNTER_UPDATE",
  COUNTER_DELETE:       "COUNTER_DELETE",
  COUNTER_TOGGLE:       "COUNTER_TOGGLE",
  COUNTER_TTS_TOGGLE:        "COUNTER_TTS_TOGGLE",
  COUNTER_SERVICE_ADD:       "COUNTER_SERVICE_ADD",
  COUNTER_SERVICE_REMOVE:    "COUNTER_SERVICE_REMOVE",

  // User / Staff
  USER_CREATE:          "USER_CREATE",
  USER_UPDATE:          "USER_UPDATE",
  USER_DELETE:          "USER_DELETE",
  USER_TOGGLE:          "USER_TOGGLE",
  USER_PERMISSION_UPDATE: "USER_PERMISSION_UPDATE",
  STAFF_COUNTER_ASSIGN:  "STAFF_COUNTER_ASSIGN",
  STAFF_COUNTER_REMOVE:  "STAFF_COUNTER_REMOVE",
  STAFF_SERVICES_ASSIGN: "STAFF_SERVICES_ASSIGN",
  STAFF_SHIFT_START:    "STAFF_SHIFT_START",
  STAFF_SHIFT_END:      "STAFF_SHIFT_END",

  // Settings
  SETTING_TTS_UPDATE:       "SETTING_TTS_UPDATE",
  SETTING_AUTO_RESET_UPDATE: "SETTING_AUTO_RESET_UPDATE",
  SETTING_SITE_CONFIG_UPDATE: "SETTING_SITE_CONFIG_UPDATE",
  SETTING_DISPLAY_MODE_UPDATE: "SETTING_DISPLAY_MODE_UPDATE",
  SETTING_LOGO_UPLOAD:      "SETTING_LOGO_UPLOAD",
};

/**
 * @param {object} opts
 * @param {import('express').Request} [opts.req]   
 * @param {object}  [opts.actor]                  
 * @param {string}  opts.action                   
 * @param {'success'|'failed'} [opts.status]
 * @param {string}  [opts.targetId]
 * @param {string}  [opts.targetType]
 * @param {object}  [opts.detail]
 */
const log = async (opts) => {
  try {
    const { req, actor, action, status = "success", targetId, targetType, detail } = opts;

    const resolvedActor = req?.user
      ? {
          actorId: req.user._id || null,
          actorUsername: req.user.username || "unknown",
          actorRole: req.user.role || "system",
        }
      : {
          actorId: actor?.id || null,
          actorUsername: actor?.username || "system",
          actorRole: actor?.role || "system",
        };

    await AuditLog.create({
      ...resolvedActor,
      action,
      status,
      targetId:  targetId  ? String(targetId)  : null,
      targetType: targetType || null,
      detail:    detail    || null,
      ipAddress: req ? (req.headers["x-forwarded-for"] || req.ip || null) : null,
      userAgent: req ? (req.headers["user-agent"] || null) : null,
      expiresAt: calcExpiresAt(action),
    });
  } catch (err) {
    console.error("[AuditLog] Ghi log thất bại:", err.message);
  }
};

/**
 * Lấy danh sách audit log có phân trang + filter
 * @param {object} filter
 * @param {string}  [filter.actorId]
 * @param {string}  [filter.action]
 * @param {string}  [filter.status]
 * @param {string}  [filter.dateFrom]   YYYY-MM-DD
 * @param {string}  [filter.dateTo]     YYYY-MM-DD
 * @param {number}  [filter.page]       default 1
 * @param {number}  [filter.limit]      default 50
 */
const getLogs = async (filter = {}) => {
  const {
    actorId,
    actorUsername,
    action,
    status,
    dateFrom,
    dateTo,
    page  = 1,
    limit = 50,
  } = filter;

  const query = {};

  if (actorId) query.actorId = actorId;
  if (actorUsername) query.actorUsername = { $regex: actorUsername.trim(), $options: "i" };
  if (action) query.action  = action;
  if (status) query.status  = status;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

module.exports = { log, getLogs, AUDIT_ACTIONS };