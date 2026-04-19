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

let speechQueue = Promise.resolve();

const sanitizeText = (text = '') => String(text).replace(/"/g, '\\"').replace(/'/g, "\\'").trim();

const downloadGoogleTTS = (text, outputPath) => new Promise((resolve, reject) => {
  const encodedText = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${TTS_LANG}&client=tw-ob`;

  const request = https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://translate.google.com/'
    },
    timeout: TTS_TIMEOUT_MS
  }, (response) => {
    if (response.statusCode !== 200) {
      reject(new Error(`Google TTS trả về status ${response.statusCode}`));
      return;
    }

    const fileStream = fs.createWriteStream(outputPath);
    response.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      resolve(outputPath);
    });

    fileStream.on('error', (error) => {
      fs.unlink(outputPath, () => {});
      reject(error);
    });
  });

  request.on('error', reject);
  request.on('timeout', () => {
    request.destroy();
    reject(new Error('Google TTS timeout'));
  });
});

const playAudio = (filePath) => new Promise((resolve, reject) => {
  const platform = os.platform();
  let command;

  switch (platform) {
    case 'darwin':
      command = `afplay "${filePath}"`;
      break;
    case 'win32':
      command = `powershell -Command "Add-Type -AssemblyName PresentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([Uri]'${filePath}'); $mp.Play(); Start-Sleep -Seconds 10; $mp.Stop(); exit 0"`;
      break;
    case 'linux':
      command = `aplay "${filePath}" 2>/dev/null || mpg123 "${filePath}" 2>/dev/null || ffplay -nodisp -autoexit "${filePath}" 2>/dev/null`;
      break;
    default:
      reject(new Error(`Không hỗ trợ phát audio trên OS: ${platform}`));
      return;
  }

  exec(command, { timeout: TTS_TIMEOUT_MS }, (error) => {
    // Dọn file tạm sau khi phát
    fs.unlink(filePath, () => {});

    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});

const speakNativeFallback = (text) => new Promise((resolve, reject) => {
  const platform = os.platform();
  const escapedText = sanitizeText(text);
  let command;

  switch (platform) {
    case 'win32':
      command = `powershell -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${escapedText.replace(/'/g, "''")}')"`;
      break;
    case 'darwin':
      command = `say "${escapedText}"`;
      break;
    case 'linux':
      command = `espeak "${escapedText}" 2>/dev/null`;
      break;
    default:
      reject(new Error(`OS not supported: ${platform}`));
      return;
  }

  exec(command, { timeout: TTS_TIMEOUT_MS }, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});

const runSpeakProcess = async (text) => {
  if (!TTS_ENABLED) {
    logger.info('TTS đang bị tắt qua cấu hình môi trường');
    return;
  }

  if (!text || text.trim() === '') {
    throw new Error('Văn bản trống, không thể đọc');
  }

  try {
    const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
    await downloadGoogleTTS(text, tmpFile);
    await playAudio(tmpFile);
    logger.info(`Đã đọc (Google TTS): "${text}"`);
    return;
  } catch (googleError) {
    if (!TTS_NATIVE_FALLBACK_ENABLED) {
      logger.error(`Google TTS thất bại và fallback native đang tắt: ${googleError.message}`);
      return;
    }

    logger.warning(`Google TTS thất bại: ${googleError.message}. Thử fallback native...`);
  }

  try {
    await speakNativeFallback(text);
    logger.info(`Đã đọc (native fallback): "${text}"`);
  } catch (nativeError) {
    logger.error(`Cả Google TTS và native TTS đều thất bại: ${nativeError.message}`);
  }
};

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
