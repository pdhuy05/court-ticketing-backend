const logger = require("../utils/Logger");
const {
  getAutoResetTime,
  isAutoResetEnabled,
  seedAutoResetDefaults,
} = require("./setting.service");
const { resetTicketsByDate } = require("./ticket");
const {
  pad,
  getDateString,
  getCurrentHHMM,
} = require("../utils/dateTime.util");

let _intervalId = null;
let _lastResetDate = null;

const getTodayString = () => getDateString(new Date());

const getYesterdayString = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getDateString(date);
};

const runAutoReset = async () => {
  try {
    const [enabled, resetTime] = await Promise.all([
      isAutoResetEnabled(),
      getAutoResetTime(),
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
      `Auto reset ticket hoàn tất cho ngày ${yesterday} (${result.resetCount} phòng)`,
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

  await runAutoReset();

  _intervalId = setInterval(runAutoReset, 60 * 1000);
};

const stop = () => {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    logger.info("Đã dừng scheduler auto reset ticket");
  }
};

module.exports = {
  getTodayString,
  getYesterdayString,
  start,
  stop,
};
