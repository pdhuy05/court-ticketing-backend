const { exec } = require('child_process');
const path = require('path');
const logger = require('../utils/Logger');

const PYTHON_BIN = process.env.TTS_PYTHON_BIN || 'python3';
const PYTHON_SCRIPT = path.join(__dirname, '../../speak.py');
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS || 5000);
const TTS_ENABLED = process.env.TTS_ENABLED !== 'false';

let speechQueue = Promise.resolve();

const isProduction = process.env.NODE_ENV === 'production';

const sanitizeText = (text = '') => String(text).replace(/"/g, '\\"').trim();

const shouldIgnoreError = (error) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || error);
  return (
    isProduction &&
    (
      message.includes('not found') ||
      message.includes('ENOENT') ||
      message.includes('pyttsx3') ||
      message.includes('No module named')
    )
  );
};

const runSpeakProcess = (text) => new Promise((resolve, reject) => {
  if (!TTS_ENABLED) {
    logger.info('TTS đang bị tắt qua cấu hình môi trường');
    resolve();
    return;
  }

  if (!text || text.trim() === '') {
    reject(new Error('Văn bản trống, không thể đọc'));
    return;
  }

  const escapedText = sanitizeText(text);
  const command = `"${PYTHON_BIN}" "${PYTHON_SCRIPT}" "${escapedText}"`;

  exec(
    command,
    {
      timeout: TTS_TIMEOUT_MS,
      env: process.env,
      maxBuffer: 1024 * 1024
    },
    (error, stdout, stderr) => {
      if (stdout?.trim()) {
        logger.info(`TTS stdout: ${stdout.trim()}`);
      }

      if (stderr?.trim()) {
        logger.warning(`Cảnh báo pyttsx3: ${stderr.trim()}`);
      }

      if (error) {
        const wrappedError = new Error(`Lỗi đọc số: ${error.message}`);
        if (shouldIgnoreError(wrappedError)) {
          logger.warning(`${wrappedError.message}. Bỏ qua vì môi trường production không có Python/TTS.`);
          resolve();
          return;
        }

        reject(wrappedError);
        return;
      }

      logger.info(`Đã đọc: "${text}"`);
      resolve();
    }
  );
});

const speak = (text) => {
  const task = speechQueue
    .catch(() => {})
    .then(() => runSpeakProcess(text));

  speechQueue = task.catch(() => {});
  return task;
};

const speakCallTicket = (displayNumber, counterName) => {
  const message = `Vui lòng mời ông bà số ${displayNumber} đến ${counterName}`;
  return speak(message).catch((error) => {
    logger.error(`Không thể đọc số: ${error.message}`);
  });
};

module.exports = {
  speak,
  speakCallTicket
};
