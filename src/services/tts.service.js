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

const downloadInFlight = new Map();
let speakerQueue = Promise.resolve();

// Xoay vòng User-Agent để tránh bị Google block
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];
let uaIndex = 0;
const nextUserAgent = () => USER_AGENTS[uaIndex++ % USER_AGENTS.length];

const TTS_VARIANTS = [
  (text, lang) => ({
    url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`,
    referer: 'https://translate.google.com/',
  }),
  (text, lang) => ({
    url: `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`,
    referer: 'https://translate.google.com/',
  }),
];

const sanitizeText = (text = '') =>
  String(text).replace(/"/g, '\\"').replace(/'/g, "\\'").trim();

const fetchOnce = (url, referer) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': nextUserAgent(),
          Referer: referer,
          Accept: 'audio/mpeg, audio/*, */*',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
        timeout: TTS_TIMEOUT_MS,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
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
      reject(new Error('timeout'));
    });
  });

const fetchGoogleTTS = async (text) => {
  // Thử lần lượt từng variant, variant nào thành công thì dùng
  for (let i = 0; i < TTS_VARIANTS.length; i++) {
    const { url, referer } = TTS_VARIANTS[i](text, TTS_LANG);
    try {
      const buffer = await fetchOnce(url, referer);
      if (i > 0) logger.info(`TTS dùng variant #${i} thành công`);
      return buffer;
    } catch (err) {
      logger.warning(`TTS variant #${i} thất bại: ${err.message}`);
    }
  }
  throw new Error('Tất cả TTS variant đều thất bại');
};

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
          command = [
            'powershell -NoProfile -Command "',
            `$p = '${tmpFile.replace(/\\/g, '\\\\').replace(/'/g, "''")}';`,
            '$wmp = New-Object -ComObject WMPlayer.OCX;',
            '$wmp.settings.autoStart = $true;',
            '$wmp.URL = $p;',
            '$wmp.controls.play();',
            'do { Start-Sleep -Milliseconds 200 } while ($wmp.playState -ne 1);',
            '$wmp.close();',
            '[System.Runtime.Interopservices.Marshal]::ReleaseComObject($wmp) | Out-Null"',
          ].join(' ');
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
        command = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${escaped.replace(/'/g, "''")}')"`;
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

  const downloadPromise = getAudioBuffer(text).catch((err) => {
    logger.warning(`Google TTS thất bại khi download: ${err.message}`);
    return null;
  });

  const task = speakerQueue
    .catch(() => {})
    .then(async () => {
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
        logger.error('Google TTS thất bại, fallback native đang tắt — bật bằng TTS_NATIVE_FALLBACK_ENABLED=true');
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
 * @param {string|number} displayNumber
 * @param {string}        counterName
 * @param {string}        [counterId]
 */
const speakCallTicket = (displayNumber, counterName, counterId) => {
  const message = `Mời ông bà số ${displayNumber} đến ${counterName}`;
  return speak(message).catch((error) => {
    logger.error(`Không thể đọc số: ${error.message}`);
  });
};

module.exports = { speak, speakCallTicket };