const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokeReason: {
      type: String,
      enum: ["logout", "password_changed", "admin_revoked", "rotated"],
      default: null,
    },
  },
  {
    collection: "refresh_tokens",
    timestamps: true,
  },
);

module.exports = mongoose.model("RefreshToken", RefreshTokenSchema);