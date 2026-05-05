const logger = require("../utils/Logger");
const {
  getShiftAutoStartTime,
  seedShiftDefaults,
} = require("./setting.service");
const {
  autoStartAllShifts,
  runServiceScheduler,
  applyCurrentScheduleState,
} = require("./shift.service");
const {
  pad,
  getDateString,
  getCurrentHHMM,
} = require("../utils/dateTime.util");

let _shiftIntervalId = null;
let _serviceIntervalId = null;
let _lastAutoStartDate = null;
let _lastRunMinute = null;

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
    logger.success(
      `Auto mở ca hoàn tất: ${result.startedCount} nhân viên được mở ca`,
    );
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
    logger.error(`Auto lịch quầy thất bại: ${error.message}`);
  }
};

const start = async () => {
  if (_shiftIntervalId || _serviceIntervalId) {
    return;
  }

  await seedShiftDefaults();
  await applyCurrentScheduleState();
  await runAutoShiftStart();
  await runAutoServiceSchedule();

  _shiftIntervalId = setInterval(runAutoShiftStart, 60 * 1000);
  _serviceIntervalId = setInterval(runAutoServiceSchedule, 60 * 1000);
};

const stop = () => {
  if (_shiftIntervalId) {
    clearInterval(_shiftIntervalId);
    _shiftIntervalId = null;
    logger.info("Đã dừng scheduler auto mở ca staff");
  }

  if (_serviceIntervalId) {
    clearInterval(_serviceIntervalId);
    _serviceIntervalId = null;
    logger.info("Đã dừng scheduler tự động mở/đóng quầy");
  }
};

module.exports = {
  start,
  stop,
};
