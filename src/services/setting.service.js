const Setting = require('../models/setting.model');

const TTS_ENABLED_KEY = 'tts_enabled';
const AUTO_RESET_ENABLED_KEY = 'auto_reset_enabled';
const AUTO_RESET_TIME_KEY = 'auto_reset_time';
const SHIFT_AUTO_START_TIME_KEY = 'shift_auto_start_time';
const SHIFT_REMINDER_MINUTES_KEY = 'shift_reminder_minutes';

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

const getShiftAutoStartTime = async () => {
  const rawValue = await getSetting(SHIFT_AUTO_START_TIME_KEY, '07:30');
  const value = typeof rawValue === 'string' ? rawValue : '07:30';
  return isValidTimeString(value) ? value : '07:30';
};

const setShiftAutoStartTime = async (time) => {
  if (!isValidTimeString(time)) {
    throw new Error('Thời gian tự động mở ca không hợp lệ, phải theo định dạng HH:MM');
  }

  await setSetting(
    SHIFT_AUTO_START_TIME_KEY,
    time,
    'Thời gian tự động mở ca cho tất cả staff (HH:MM)'
  );

  return time;
};

const getShiftReminderMinutes = async () => {
  const rawValue = await getSetting(SHIFT_REMINDER_MINUTES_KEY, 15);
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : 15;
};

const setShiftReminderMinutes = async (minutes) => {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0 || value > 120) {
    throw new Error('Thời gian nhắc nhở phải từ 0 đến 120 phút');
  }

  await setSetting(
    SHIFT_REMINDER_MINUTES_KEY,
    value,
    'Số phút nhắc nhở trước khi kết thúc ca'
  );

  return value;
};

const getShiftSettings = async () => {
  const [autoStartTime, reminderMinutes] = await Promise.all([
    getShiftAutoStartTime(),
    getShiftReminderMinutes()
  ]);

  return { autoStartTime, reminderMinutes };
};

const seedShiftDefaults = async () => {
  await Setting.findOneAndUpdate(
    { key: SHIFT_AUTO_START_TIME_KEY },
    {
      $setOnInsert: {
        key: SHIFT_AUTO_START_TIME_KEY,
        value: '07:30',
        description: 'Thời gian tự động mở ca cho tất cả staff (HH:MM)'
      }
    },
    { upsert: true, runValidators: true }
  );

  await Setting.findOneAndUpdate(
    { key: SHIFT_REMINDER_MINUTES_KEY },
    {
      $setOnInsert: {
        key: SHIFT_REMINDER_MINUTES_KEY,
        value: 15,
        description: 'Số phút nhắc nhở trước khi kết thúc ca'
      }
    },
    { upsert: true, runValidators: true }
  );
};

module.exports = {
  AUTO_RESET_ENABLED_KEY,
  AUTO_RESET_TIME_KEY,
  SHIFT_AUTO_START_TIME_KEY,
  SHIFT_REMINDER_MINUTES_KEY,
  TTS_ENABLED_KEY,
  getAutoResetSettings,
  getAutoResetTime,
  getSetting,
  getShiftAutoStartTime,
  getShiftReminderMinutes,
  getShiftSettings,
  isTtsEnabled,
  isAutoResetEnabled,
  seedAutoResetDefaults,
  seedShiftDefaults,
  setAutoResetEnabled,
  setAutoResetTime,
  setSetting,
  setShiftAutoStartTime,
  setShiftReminderMinutes,
  setTtsEnabled
};
