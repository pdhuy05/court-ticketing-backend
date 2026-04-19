const Setting = require('../models/setting.model');

const TTS_ENABLED_KEY = 'tts_enabled';

const toBoolean = (raw, defaultValue = true) => {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (v === 'false' || v === '0' || v === 'off' || v === 'no') {
      return false;
    }
    if (v === 'true' || v === '1' || v === 'on' || v === 'yes') {
      return true;
    }
  }
  return Boolean(raw);
};

const isTtsEnabled = async () => {
  const doc = await Setting.findOne({ key: TTS_ENABLED_KEY }).lean();
  if (!doc) {
    return true;
  }
  return toBoolean(doc.value, true);
};

const setTtsEnabled = async (enabled) => {
  const value = Boolean(enabled);
  await Setting.findOneAndUpdate(
    { key: TTS_ENABLED_KEY },
    { $set: { key: TTS_ENABLED_KEY, value } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  return value;
};

module.exports = {
  isTtsEnabled,
  setTtsEnabled,
  TTS_ENABLED_KEY
};
