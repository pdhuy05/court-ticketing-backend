const settingService = require('../../services/setting.service');
const asyncHandler = require('../../utils/asyncHandler');

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

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});
