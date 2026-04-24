const logger = require('../utils/Logger');
const { getShiftAutoStartTime, seedShiftDefaults } = require('./setting.service');
const { autoStartAllShifts, runServiceScheduler } = require('./shift.service');

let _shiftIntervalId = null;
let _serviceIntervalId = null;
let _lastAutoStartDate = null;
let _lastRunMinute = null;

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

const runAutoServiceSchedule = async () => {
  try {
    const now = new Date();
    const currentMinute = `${getDateString(now)} ${getCurrentHHMM()}`;

    if (_lastRunMinute === currentMinute) {
      return;
    }

    _lastRunMinute = currentMinute;
    await runServiceScheduler();
  } catch (error) {
    logger.error(`Auto lịch dịch vụ thất bại: ${error.message}`);
  }
};

const start = async () => {
  if (_shiftIntervalId || _serviceIntervalId) {
    return;
  }

  await seedShiftDefaults();

  _shiftIntervalId = setInterval(runAutoShiftStart, 60 * 1000);
  _serviceIntervalId = setInterval(runAutoServiceSchedule, 60 * 1000);

  logger.info('Đã khởi động scheduler auto mở ca staff');
  logger.info('Đã khởi động scheduler tự động mở/đóng dịch vụ');
};

const stop = () => {
  if (_shiftIntervalId) {
    clearInterval(_shiftIntervalId);
    _shiftIntervalId = null;
    logger.info('Đã dừng scheduler auto mở ca staff');
  }

  if (_serviceIntervalId) {
    clearInterval(_serviceIntervalId);
    _serviceIntervalId = null;
    logger.info('Đã dừng scheduler tự động mở/đóng dịch vụ');
  }
};

module.exports = {
  start,
  stop
};
