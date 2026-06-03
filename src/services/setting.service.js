const Setting = require('../models/setting.model');

const SITE_BRANCH_NAME_KEY = 'site_branch_name';
const SITE_LOGO_URL_KEY = 'site_logo_url';
const SITE_PRIMARY_COLOR_KEY = 'site_primary_color';
const SITE_TICKER_TEXT_KEY = 'site_ticker_text';
const SITE_WORKING_HOURS_KEY = 'site_working_hours';
const SITE_ADDRESS_KEY = 'site_address';
const SITE_ANNOUNCEMENT_KEY = 'site_announcement';

const SITE_CONFIG_DEFAULTS = {
  [SITE_BRANCH_NAME_KEY]: 'Tòa án nhân dân',
  [SITE_LOGO_URL_KEY]: '/assets/logotoaan.png',
  [SITE_PRIMARY_COLOR_KEY]: '#1a3c6e',
  [SITE_TICKER_TEXT_KEY]: '',
  [SITE_WORKING_HOURS_KEY]: '07:30 - 11:30 | 13:00 - 17:00',
  [SITE_ADDRESS_KEY]: '',
  [SITE_ANNOUNCEMENT_KEY]: '',
};

const TTS_ENABLED_KEY = 'tts_enabled';
const AUTO_RESET_ENABLED_KEY = 'auto_reset_enabled';
const AUTO_RESET_TIME_KEY = 'auto_reset_time';
const AUTO_RESET_LAST_DATE_KEY = 'auto_reset_last_date';
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

const getLastResetDate = async () => {
  return await getSetting(AUTO_RESET_LAST_DATE_KEY, null);
};

const setLastResetDate = async (dateString) => {
  await setSetting(
    AUTO_RESET_LAST_DATE_KEY,
    dateString,
    'Ngày reset ticket gần nhất (YYYY-MM-DD)'
  );
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


// ─── Display Mode ────────────────────────────────────────────────────────────
const DISPLAY_MODE_KEY = 'display_mode';
const DISPLAY_MODE_DEFAULT = 'service'; // 'service' | 'queue'

const getDisplayMode = async () => {
  const raw = await getSetting(DISPLAY_MODE_KEY, DISPLAY_MODE_DEFAULT);
  return raw === 'queue' ? 'queue' : 'service';
};

const setDisplayMode = async (mode) => {
  if (mode !== 'service' && mode !== 'queue') {
    throw new Error("display_mode phải là 'service' hoặc 'queue'");
  }
  await setSetting(
    DISPLAY_MODE_KEY,
    mode,
    "Chế độ hiển thị màn hình quầy: 'service' (theo yêu cầu) hoặc 'queue' (danh sách chờ)"
  );
  return mode;
};

const seedDisplayModeDefault = async () => {
  await Setting.findOneAndUpdate(
    { key: DISPLAY_MODE_KEY },
    {
      $setOnInsert: {
        key: DISPLAY_MODE_KEY,
        value: DISPLAY_MODE_DEFAULT,
        description: "Chế độ hiển thị màn hình quầy: 'service' hoặc 'queue'",
      },
    },
    { upsert: true, runValidators: true }
  );
};

// ─── Site Config ─────────────────────────────────────────────────────────────
const getSiteConfig = async () => {
  const keys = Object.keys(SITE_CONFIG_DEFAULTS);
  const docs = await Setting.find({ key: { $in: keys } }).lean();
  const map = {};
  docs.forEach((doc) => { map[doc.key] = doc.value; });

  return {
    branchName: map[SITE_BRANCH_NAME_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_BRANCH_NAME_KEY],
    logoUrl: map[SITE_LOGO_URL_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_LOGO_URL_KEY],
    primaryColor: map[SITE_PRIMARY_COLOR_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_PRIMARY_COLOR_KEY],
    tickerText: map[SITE_TICKER_TEXT_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_TICKER_TEXT_KEY],
    workingHours: map[SITE_WORKING_HOURS_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_WORKING_HOURS_KEY],
    address: map[SITE_ADDRESS_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_ADDRESS_KEY],
    announcement: map[SITE_ANNOUNCEMENT_KEY] ?? SITE_CONFIG_DEFAULTS[SITE_ANNOUNCEMENT_KEY],
  };
};

const updateSiteConfig = async (fields) => {
  const FIELD_MAP = {
    branchName: SITE_BRANCH_NAME_KEY,
    logoUrl: SITE_LOGO_URL_KEY,
    primaryColor: SITE_PRIMARY_COLOR_KEY,
    tickerText: SITE_TICKER_TEXT_KEY,
    workingHours: SITE_WORKING_HOURS_KEY,
    address: SITE_ADDRESS_KEY,
    announcement: SITE_ANNOUNCEMENT_KEY,
  };

  const ops = Object.entries(fields)
    .filter(([k]) => FIELD_MAP[k] !== undefined)
    .map(([k, v]) => setSetting(FIELD_MAP[k], v));

  await Promise.all(ops);
  return getSiteConfig();
};

const seedSiteConfigDefaults = async () => {
  const ops = Object.entries(SITE_CONFIG_DEFAULTS).map(([key, value]) =>
    Setting.findOneAndUpdate(
      { key },
      { $setOnInsert: { key, value, description: `Site config: ${key}` } },
      { upsert: true, runValidators: true }
    )
  );
  await Promise.all(ops);
};

module.exports = {
  AUTO_RESET_ENABLED_KEY,
  AUTO_RESET_TIME_KEY,
  AUTO_RESET_LAST_DATE_KEY,
  SHIFT_AUTO_START_TIME_KEY,
  SHIFT_REMINDER_MINUTES_KEY,
  TTS_ENABLED_KEY,
  getAutoResetSettings,
  getAutoResetTime,
  getLastResetDate,
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
  setLastResetDate,
  setSetting,
  setShiftAutoStartTime,
  setShiftReminderMinutes,
  setTtsEnabled,
  getSiteConfig,
  updateSiteConfig,
  seedSiteConfigDefaults,
  SITE_BRANCH_NAME_KEY,
  SITE_LOGO_URL_KEY,
  SITE_PRIMARY_COLOR_KEY,
  SITE_TICKER_TEXT_KEY,
  SITE_WORKING_HOURS_KEY,
  SITE_ADDRESS_KEY,
  SITE_ANNOUNCEMENT_KEY,
  DISPLAY_MODE_KEY,
  getDisplayMode,
  setDisplayMode,
  seedDisplayModeDefault,
};