const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/refreshToken.model");
const ApiError = require("../utils/ApiError");

const ACCESS_TOKEN_TTL_BY_ROLE = {
  admin: "15m",
  staff: "8h",
};
const DEFAULT_ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getAccessTokenTtl = (role) =>
  ACCESS_TOKEN_TTL_BY_ROLE[role] || DEFAULT_ACCESS_TOKEN_TTL;

const signAccessToken = (user) => {
  const expiresIn = getAccessTokenTtl(user.role);
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn },
  );
  return { accessToken, expiresIn };
};

const generateRefreshTokenString = () =>
  crypto.randomBytes(64).toString("hex");

const issueTokens = async (user, meta = {}) => {
  const { accessToken, expiresIn } = signAccessToken(user);
  const refreshString = generateRefreshTokenString();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({
    userId: user._id,
    token: refreshString,
    expiresAt,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    isRevoked: false,
  });

  return {
    accessToken,
    refreshToken: refreshString,
    expiresIn,
  };
};

const refreshAccess = async (refreshTokenString, meta = {}) => {
  const stored = await RefreshToken.findOne({ token: refreshTokenString });

  if (!stored) {
    throw new ApiError(401, "Refresh token không hợp lệ");
  }

  if (stored.isRevoked) {
    await RefreshToken.updateMany(
      { userId: stored.userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokeReason: "rotated" },
    );
    throw new ApiError(401, "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
  }

  if (stored.expiresAt < new Date()) {
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const User = require("../models/user.model");
  const user = await User.findById(stored.userId).select("-password");

  if (!user || !user.isActive) {
    throw new ApiError(401, "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa");
  }

  stored.isRevoked = true;
  stored.revokedAt = new Date();
  stored.revokeReason = "rotated";
  await stored.save();

  return issueTokens(user, meta);
};

const revokeToken = async (refreshTokenString, reason = "logout") => {
  const result = await RefreshToken.findOneAndUpdate(
    { token: refreshTokenString, isRevoked: false },
    { isRevoked: true, revokedAt: new Date(), revokeReason: reason },
  );
  return !!result;
};

const revokeAll = async (userId, reason = "password_changed") => {
  const result = await RefreshToken.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true, revokedAt: new Date(), revokeReason: reason },
  );
  return result.modifiedCount || 0;
};

module.exports = { issueTokens, refreshAccess, revokeToken, revokeAll };