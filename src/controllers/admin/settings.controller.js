const settingService = require('../../services/setting.service');
const asyncHandler = require('../../utils/asyncHandler');
const path = require('path');
const fs = require('fs');

exports.patchTtsEnabled = async (req, res) => {
  const value = await settingService.setTtsEnabled(req.body.enabled);

  res.json({
    success: true,
    data: {
      tts_enabled: value
    },
    message: value ? 'Đã bật phát giọng nói (TTS)' : 'Đã tắt phát giọng nói (TTS)'
  });
};

exports.getTtsEnabled = async (req, res) => {
  const value = await settingService.isTtsEnabled();

  res.json({
    success: true,
    data: {
      tts_enabled: value
    }
  });
};

exports.getAutoResetSettings = async (req, res) => {
  const value = await settingService.getAutoResetSettings();

  res.json({
    success: true,
    data: value
  });
};

exports.patchAutoResetEnabled = async (req, res) => {
  const value = await settingService.setAutoResetEnabled(req.body.enabled);

  res.json({
    success: true,
    data: {
      auto_reset_enabled: value
    },
    message: value ? 'Đã bật tự động reset ticket' : 'Đã tắt tự động reset ticket'
  });
};

exports.patchAutoResetTime = async (req, res) => {
  const value = await settingService.setAutoResetTime(req.body.time);

  res.json({
    success: true,
    data: {
      auto_reset_time: value
    },
    message: `Đã cập nhật thời gian tự động reset ticket thành ${value}`
  });
};

exports.getSiteConfig = async (req, res) => {
  const data = await settingService.getSiteConfig();
  res.json({ success: true, data });
};

exports.patchSiteConfig = async (req, res) => {
  const data = await settingService.updateSiteConfig(req.body);
  res.json({
    success: true,
    data,
    message: 'Đã cập nhật cấu hình giao diện thành công',
  });
};

exports.getDisplayMode = async (req, res) => {
  const mode = await settingService.getDisplayMode();
  res.json({
    success: true,
    data: { display_mode: mode },
  });
};

exports.patchDisplayMode = async (req, res) => {
  const mode = await settingService.setDisplayMode(req.body.mode);
  res.json({
    success: true,
    data: { display_mode: mode },
    message: mode === 'service'
      ? 'Màn hình quầy: Hiển thị theo Yêu Cầu (service mode)'
      : 'Màn hình quầy: Hiển thị Danh Sách Chờ (queue mode)',
  });
};

exports.uploadLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file được upload' });
  }

  const logoDir = path.join(__dirname, '../../public/logo');

  if (!fs.existsSync(logoDir)) {
    fs.mkdirSync(logoDir, { recursive: true });
  }

  const existingFiles = fs.readdirSync(logoDir);
  for (const file of existingFiles) {
    if (file !== 'logo.png' && file !== req.file.filename) {
      try { fs.unlinkSync(path.join(logoDir, file)); } catch (_) {}
    }
  }

  const logoUrl = `/api/public/logo/${req.file.filename}`;

  await settingService.updateSiteConfig({ logoUrl });

  res.json({
    success: true,
    data: { logoUrl },
    message: 'Upload logo thành công',
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});