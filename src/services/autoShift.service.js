const logger = require('../utils/Logger');
const { getShiftAutoStartTime, seedShiftDefaults } = require('./setting.service');
const { autoStartAllShifts } = require('./shift.service');

let _intervalId = null;
let _lastAutoStartDate = null;

const pad = (value) => String(value).padStart(2, '0');

const getDateString = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}-${month}-${day}`;
};

const getCurrentHHMM = () => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const runAutoShiftStart = async () => {
  try {
    const autoStartTime = await getShiftAutoStartTime();

    if (getCurrentHHMM() !== autoStartTime) {
      return;
    }

    const today = getDateString(new Date());

    if (_lastAutoStartDate === today) {
      return;
    }

    _lastAutoStartDate = today;

    logger.info(`Auto mở ca shift bắt đầu lúc ${autoStartTime}`);
    const result = await autoStartAllShifts();
    logger.success(`Auto mở ca hoàn tất: ${result.startedCount} nhân viên được mở ca`);
  } catch (error) {
    logger.error(`Auto mở ca thất bại: ${error.message}`);
  }
};

const start = async () => {
  if (_intervalId) {
    return;
  }

  await seedShiftDefaults();
  _intervalId = setInterval(runAutoShiftStart, 60 * 1000);
  logger.info('Đã khởi động scheduler auto mở ca shift');
};

const stop = () => {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    logger.info('Đã dừng scheduler auto mở ca shift');
  }
};

module.exports = { start, stop };
