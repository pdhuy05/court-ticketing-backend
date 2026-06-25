const authService  = require("../services/auth.service");
const asyncHandler = require("../utils/asyncHandler");

const getMeta = (req) => ({
  ipAddress: req.headers["x-forwarded-for"] || req.ip || null,
  userAgent: req.headers["user-agent"] || null,
});

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const result = await authService.login(username, password, getMeta(req));

  res.json({
    success: true,
    data: result,
  });
};

exports.logout = async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"] || null;
  await authService.logout(refreshToken, req.user, getMeta(req));

  res.json({
    success: true,
    message: "Đăng xuất thành công",
  });
};

exports.refresh = async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"];

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "Thiếu refresh token",
    });
  }

  const tokens = await authService.refreshToken(refreshToken, getMeta(req));

  res.json({
    success: true,
    data: tokens,
  });
};

exports.me = async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.json({ success: true, data: user });
};

exports.updateProfile = async (req, res) => {
  const user = await authService.updateMyProfile(req.user._id, req.body, getMeta(req));
  res.json({
    success: true,
    data: user,
    message: "Cập nhật hồ sơ thành công",
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});