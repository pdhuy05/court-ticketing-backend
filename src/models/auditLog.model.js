const mongoose = require("mongoose");

const TRANSIENT_TTL_DAYS = 30;

const TRANSIENT_ACTIONS = new Set([
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "STAFF_SHIFT_START",
  "STAFF_SHIFT_END",
  "TICKET_AUTO_RESET",
]);

const calcExpiresAt = (action) => {
  if (!TRANSIENT_ACTIONS.has(action)) return null;
  const d = new Date();
  d.setDate(d.getDate() + TRANSIENT_TTL_DAYS);
  return d;
};

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorUsername: {
      type: String,
      default: "system",
    },
    actorRole: {
      type: String,
      enum: ["admin", "staff", "system"],
      default: "system",
    },
    action: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    targetId: { type: String, default: null },
    targetType: { type: String, default: null },
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "audit_logs",
    timestamps: true,
  },
);

AuditLogSchema.index({ actorId: 1,  createdAt: -1 });
AuditLogSchema.index({ action:  1,  createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
module.exports.calcExpiresAt = calcExpiresAt;