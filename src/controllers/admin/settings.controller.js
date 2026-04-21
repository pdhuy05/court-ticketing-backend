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

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});
