const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/Logger');

const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS || 10000);
const TTS_ENABLED = process.env.TTS_ENABLED !== 'false';
const TTS_LANG = process.env.TTS_LANG || 'vi';
const TTS_NATIVE_FALLBACK_ENABLED = process.env.TTS_NATIVE_FALLBACK_ENABLED
  ? process.env.TTS_NATIVE_FALLBACK_ENABLED === 'true'
  : os.platform() !== 'win32';

const CACHE_MAX = 100;
const audioCache = new Map();

const cacheGet = (text) => audioCache.get(text) || null;

const cacheSet = (text, buffer) => {
  if (audioCache.size >= CACHE_MAX) {
    audioCache.delete(audioCache.keys().next().value);
  }
  audioCache.set(text, buffer);
};

// Map lưu các promise đang download dở, tránh download trùng lặp
const downloadInFlight = new Map();

let speakerQueue = Promise.resolve();

const sanitizeText = (text = '') =>
  String(text).replace(/"/g, '\\"').replace(/'/g, "\\'").trim();

const fetchGoogleTTS = (text) =>
  new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${TTS_LANG}&client=tw-ob`;

    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://translate.google.com/',
        },
        timeout: TTS_TIMEOUT_MS,
      },
      (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Google TTS status ${response.statusCode}`));
          return;
        }
        const chunks = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Google TTS timeout'));
    });
  });

const getAudioBuffer = (text) => {
  const cached = cacheGet(text);
  if (cached) {
    logger.info(`TTS cache hit: "${text}"`);
    return Promise.resolve(cached);
  }

  if (downloadInFlight.has(text)) {
    logger.info(`TTS đang download, chờ kết quả chung: "${text}"`);
    return downloadInFlight.get(text);
  }

  logger.info(`TTS download: "${text}"`);
  const promise = fetchGoogleTTS(text)
    .then((buffer) => {
      cacheSet(text, buffer);
      return buffer;
    })
    .finally(() => {
      downloadInFlight.delete(text);
    });

  downloadInFlight.set(text, promise);
  return promise;
};

/**
 * Prefetch audio cho một text — bắt đầu download ngay lập tức mà không chờ play.
 * Gọi hàm này khi bạn biết sắp cần phát text đó (ví dụ: khi số tiếp theo vừa được gọi).
 */
const prefetch = (text) => {
  if (!TTS_ENABLED || !text || !text.trim()) return;
  // Fire-and-forget: không cần await, chỉ cần kick-off download
  getAudioBuffer(text).catch((err) => {
    logger.warning(`TTS prefetch thất bại cho "${text}": ${err.message}`);
  });
};

const playBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
    );

    fs.writeFile(tmpFile, buffer, (writeErr) => {
      if (writeErr) {
        reject(writeErr);
        return;
      }

      const platform = os.platform();
      let command;
      switch (platform) {
        case 'darwin':
          command = `afplay "${tmpFile}"`;
          break;
        case 'win32':
          command = `powershell -Command "Add-Type -AssemblyName PresentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([Uri]'${tmpFile}'); $mp.Play(); Start-Sleep -Seconds 10; $mp.Stop(); exit 0"`;
          break;
        case 'linux':
          command = `aplay "${tmpFile}" 2>/dev/null || mpg123 "${tmpFile}" 2>/dev/null || ffplay -nodisp -autoexit "${tmpFile}" 2>/dev/null`;
          break;
        default:
          fs.unlink(tmpFile, () => {});
          reject(new Error(`Không hỗ trợ phát audio trên OS: ${platform}`));
          return;
      }

      exec(command, { timeout: TTS_TIMEOUT_MS }, (error) => {
        fs.unlink(tmpFile, () => {});
        if (error) reject(error);
        else resolve();
      });
    });
  });

const speakNativeFallback = (text) =>
  new Promise((resolve, reject) => {
    const platform = os.platform();
    const escaped = sanitizeText(text);
    let command;
    switch (platform) {
      case 'win32':
        command = `powershell -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${escaped.replace(/'/g, "''")}')"`;
        break;
      case 'darwin':
        command = `say "${escaped}"`;
        break;
      case 'linux':
        command = `espeak "${escaped}" 2>/dev/null`;
        break;
      default:
        reject(new Error(`OS not supported: ${platform}`));
        return;
    }
    exec(command, { timeout: TTS_TIMEOUT_MS }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const speak = (text) => {
  if (!TTS_ENABLED) {
    logger.info('TTS đang bị tắt');
    return Promise.resolve();
  }
  if (!text || !text.trim()) return Promise.resolve();

  // *** KEY FIX: Bắt đầu download NGAY LẬP TỨC, không chờ queue ***
  // Download chạy song song với bất kỳ audio nào đang phát trước đó.
  const downloadPromise = getAudioBuffer(text).catch((err) => {
    logger.warning(`Google TTS thất bại khi download: ${err.message}`);
    return null;
  });

  const task = speakerQueue
    .catch(() => {})
    .then(async () => {
      // Lúc này download có thể đã xong (hoặc gần xong) → không bị delay thêm
      const buffer = await downloadPromise;

      if (buffer) {
        try {
          await playBuffer(buffer);
          logger.info(`Đã đọc (Google TTS): "${text}"`);
          return;
        } catch (playErr) {
          logger.warning(`Lỗi phát MP3: ${playErr.message}`);
        }
      }

      if (!TTS_NATIVE_FALLBACK_ENABLED) {
        logger.error('Google TTS thất bại, fallback native đang tắt');
        return;
      }

      try {
        await speakNativeFallback(text);
        logger.info(`Đã đọc (native fallback): "${text}"`);
      } catch (nativeErr) {
        logger.error(`Cả 2 TTS đều thất bại: ${nativeErr.message}`);
      }
    });

  speakerQueue = task.catch(() => {});
  return task;
};

/**
 * @param {string|number} displayNumber  - Số hiển thị trên màn hình
 * @param {string}        counterName    - Tên quầy (ví dụ: "Quầy 1")
 * @param {string}        [counterId]    - ID quầy (không dùng trong TTS)
 */
const speakCallTicket = (displayNumber, counterName, counterId) => {
  const message = `Mời ông bà số ${displayNumber} đến ${counterName}`;
  return speak(message).catch((error) => {
    logger.error(`Không thể đọc số: ${error.message}`);
  });
};

/**
 * Prefetch audio cho số tiếp theo để khi gọi speak() thì audio đã sẵn sàng.
 * Gọi hàm này ngay khi bạn biết số/quầy tiếp theo — ví dụ sau khi gọi xong số hiện tại.
 *
 * Ví dụ sử dụng:
 *   await speakCallTicket(currentNumber, currentCounter);
 *   prefetchCallTicket(nextNumber, nextCounter);  // download ngầm cho số kế
 *
 * @param {string|number} displayNumber
 * @param {string}        counterName
 */
const prefetchCallTicket = (displayNumber, counterName) => {
  const message = `Mời ông bà số ${displayNumber} đến ${counterName}`;
  prefetch(message);
};

module.exports = { speak, speakCallTicket, prefetch, prefetchCallTicket };