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

// ─── Audio cache (LRU, tối đa 100 entry) ─────────────────────────────────────
// Key: text gốc → Value: Buffer MP3
const CACHE_MAX = 100;
const audioCache = new Map();

const cacheGet = (text) => audioCache.get(text) || null;

const cacheSet = (text, buffer) => {
  if (audioCache.size >= CACHE_MAX) {
    audioCache.delete(audioCache.keys().next().value);
  }
  audioCache.set(text, buffer);
};

// ─── Download dedup ───────────────────────────────────────────────────────────
// Nếu 2 phòng enqueue cùng 1 câu gần nhau → chỉ download 1 lần
const downloadInFlight = new Map(); // text → Promise<Buffer>

// ─── 1 queue duy nhất cho loa ────────────────────────────────────────────────
let speakerQueue = Promise.resolve();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Lấy Buffer MP3 cho `text` — từ cache hoặc download.
 * Nhiều lời gọi cùng text cùng lúc chỉ tạo 1 request (dedup).
 */
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
          command = `powershell -Command "
$sig = '[DllImport(""winmm.dll"")] public static extern int mciSendString(string cmd, System.Text.StringBuilder ret, int retLen, IntPtr hwnd);';
$mci = Add-Type -MemberDefinition $sig -Name MCI -Namespace Win -PassThru;
$file = '${tmpFile}'.Replace('\\\\','\\');
$mci::mciSendString(\"open \`\\"$file\`\\" type mpegvideo alias tts\", $null, 0, [IntPtr]::Zero) | Out-Null;
$mci::mciSendString('play tts wait', $null, 0, [IntPtr]::Zero) | Out-Null;
$mci::mciSendString('close tts', $null, 0, [IntPtr]::Zero) | Out-Null;
exit 0"`;
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

// ─── Core speak ───────────────────────────────────────────────────────────────

/**
 * Enqueue câu `text` vào queue loa.
 *
 * Điểm mấu chốt:
 *   getAudioBuffer() được gọi NGAY LẬP TỨC khi speak() được gọi,
 *   không chờ loa rảnh. Trong lúc loa đang phát câu trước, MP3 của
 *   câu này đã được download về buffer sẵn sàng.
 *
 *   Khi đến lượt phát → await downloadPromise thường resolve ngay → 0 delay.
 */
const speak = (text) => {
  if (!TTS_ENABLED) {
    logger.info('TTS đang bị tắt');
    return Promise.resolve();
  }
  if (!text || !text.trim()) return Promise.resolve();

  // Bắt đầu download / lấy cache NGAY BÂY GIỜ, song song với loa
  const downloadPromise = getAudioBuffer(text).catch((err) => {
    logger.warning(`Google TTS thất bại khi download: ${err.message}`);
    return null; // null → thử native fallback
  });

  const task = speakerQueue
    .catch(() => {})
    .then(async () => {
      const buffer = await downloadPromise; // thường đã xong lúc này

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
 * @param {string|number} displayNumber
 * @param {string}        counterName
 * @param {string}        [counterId]  - giữ để tương thích với controller
 */
const speakCallTicket = (displayNumber, counterName, counterId) => {
  const message = `Mời ông bà số ${displayNumber} đến ${counterName}`;
  return speak(message).catch((error) => {
    logger.error(`Không thể đọc số: ${error.message}`);
  });
};

module.exports = { speak, speakCallTicket };