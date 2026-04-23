const Setting = require('../models/setting.model');

const TTS_ENABLED_KEY = 'tts_enabled';
const AUTO_RESET_ENABLED_KEY = 'auto_reset_enabled';
const AUTO_RESET_TIME_KEY = 'auto_reset_time';

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

const getSetting = async (key, defaultValue) => {
  const doc = await Setting.findOne({ key }).lean();
  return doc ? doc.value : defaultValue;
};

const setSetting = async (key, value, description = null) => {
  const update = {
    $set: { key, value }
  };

  if (description !== null) {
    update.$set.description = description;
  }

  return Setting.findOneAndUpdate(
    { key },
    update,
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
};

const isValidTimeString = (time) => {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return false;
  }

  const [hours, minutes] = time.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const isTtsEnabled = async () => {
  const rawValue = await getSetting(TTS_ENABLED_KEY, true);
  return toBoolean(rawValue, true);
};

const setTtsEnabled = async (enabled) => {
  const value = Boolean(enabled);
  await setSetting(TTS_ENABLED_KEY, value);
  return value;
};

const seedAutoResetDefaults = async () => {
  await Setting.findOneAndUpdate(
    { key: AUTO_RESET_ENABLED_KEY },
    {
      $setOnInsert: {
        key: AUTO_RESET_ENABLED_KEY,
        value: true,
        description: 'Bật hoặc tắt tự động reset ticket hằng ngày'
      }
    },
    { upsert: true, runValidators: true }
  );

  await Setting.findOneAndUpdate(
    { key: AUTO_RESET_TIME_KEY },
    {
      $setOnInsert: {
        key: AUTO_RESET_TIME_KEY,
        value: '00:00',
        description: 'Thời gian tự động reset ticket theo định dạng HH:MM'
      }
    },
    { upsert: true, runValidators: true }
  );
};

const isAutoResetEnabled = async () => {
  const rawValue = await getSetting(AUTO_RESET_ENABLED_KEY, true);
  return toBoolean(rawValue, true);
};

const setAutoResetEnabled = async (enabled) => {
  const value = Boolean(enabled);
  await setSetting(
    AUTO_RESET_ENABLED_KEY,
    value,
    'Bật hoặc tắt tự động reset ticket hằng ngày'
  );
  return value;
};

const getAutoResetTime = async () => {
  const rawValue = await getSetting(AUTO_RESET_TIME_KEY, '00:00');
  const value = typeof rawValue === 'string' ? rawValue : '00:00';

  if (!isValidTimeString(value)) {
    return '00:00';
  }

  return value;
};

const setAutoResetTime = async (time) => {
  if (!isValidTimeString(time)) {
    throw new Error('Thời gian auto reset không hợp lệ, phải theo định dạng HH:MM');
  }

  await setSetting(
    AUTO_RESET_TIME_KEY,
    time,
    'Thời gian tự động reset ticket theo định dạng HH:MM'
  );

  return time;
};

const getAutoResetSettings = async () => {
  const [enabled, time] = await Promise.all([
    isAutoResetEnabled(),
    getAutoResetTime()
  ]);

  return { enabled, time };
};

module.exports = {
  AUTO_RESET_ENABLED_KEY,
  AUTO_RESET_TIME_KEY,
  TTS_ENABLED_KEY,
  getAutoResetSettings,
  getAutoResetTime,
  getSetting,
  isTtsEnabled,
  isAutoResetEnabled,
  seedAutoResetDefaults,
  setAutoResetEnabled,
  setAutoResetTime,
  setSetting,
  setTtsEnabled
};
