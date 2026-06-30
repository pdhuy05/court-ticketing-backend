const logger = require('../utils/Logger');
const {
  getAutoResetTime,
  isAutoResetEnabled,
  seedAutoResetDefaults,
  getLastResetDate,
  setLastResetDate,
} = require('./setting.service');
const { resetTicketsByDate } = require('./ticket');
const {
  pad,
  getDateString,
  getCurrentHHMM,
} = require('../utils/dateTime.util');
const { log: auditLog, AUDIT_ACTIONS } = require('./audit.service');

let _intervalId = null;

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
    const lastResetDate = await getLastResetDate(); 

    if (lastResetDate === today) {
      return;
    }

    await setLastResetDate(today);

    const yesterday = getYesterdayString();

    logger.info(`Auto reset ticket bắt đầu cho ngày ${yesterday}`);
    const result = await resetTicketsByDate(yesterday, null);
    logger.success(
      `Auto reset ticket hoàn tất cho ngày ${yesterday} (${result.resetCount} phòng)`,
    );

    await auditLog({
      actor: { username: "system", role: "system" },
      action: AUDIT_ACTIONS.TICKET_AUTO_RESET,
      status: "success",
      detail: { date: yesterday, resetCount: result.resetCount, counterCount: result.counterCount },
    });
  } catch (error) {
    logger.error(`Auto reset ticket thất bại: ${error.message}`);

    await auditLog({
      actor: { username: "system", role: "system" },
      action: AUDIT_ACTIONS.TICKET_AUTO_RESET,
      status: "failed",
      detail: { reason: error.message },
    });
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
    logger.info('Đã dừng scheduler auto reset ticket');
  }
};

module.exports = {
  getTodayString,
  getYesterdayString,
  start,
  stop,
};