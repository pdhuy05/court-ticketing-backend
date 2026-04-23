const logger = require('../utils/Logger');
const {
  getAutoResetTime,
  isAutoResetEnabled,
  seedAutoResetDefaults
} = require('./setting.service');
const { resetTicketsByDate } = require('./ticket');

let _intervalId = null;
let _lastResetDate = null;

const pad = (value) => String(value).padStart(2, '0');

const getDateString = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}-${month}-${day}`;
};

const getTodayString = () => getDateString(new Date());

const getYesterdayString = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getDateString(date);
};

const getCurrentHHMM = () => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const runAutoReset = async () => {
  try {
    const [enabled, resetTime] = await Promise.all([
      isAutoResetEnabled(),
      getAutoResetTime()
    ]);

    if (!enabled) {
      return;
    }

    if (getCurrentHHMM() !== resetTime) {
      return;
    }

    const today = getTodayString();

    if (_lastResetDate === today) {
      return;
    }

    _lastResetDate = today;

    const yesterday = getYesterdayString();

    logger.info(`Auto reset ticket bắt đầu cho ngày ${yesterday}`);
    const result = await resetTicketsByDate(yesterday, null);
    logger.success(
      `Auto reset ticket hoàn tất cho ngày ${yesterday} (${result.resetCount} quầy)`
    );
  } catch (error) {
    logger.error(`Auto reset ticket thất bại: ${error.message}`);
  }
};

const start = async () => {
  if (_intervalId) {
    return;
  }

  await seedAutoResetDefaults();
  _intervalId = setInterval(runAutoReset, 60 * 1000);
  logger.info('Đã khởi động scheduler auto reset ticket');
};

const stop = () => {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    logger.info('Đã dừng scheduler auto reset ticket');
  }
};

module.exports = {
  getCurrentHHMM,
  getTodayString,
  getYesterdayString,
  start,
  stop
};
