const { exec, execFile } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/Logger');

const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS || 20000);
const TTS_ENABLED = process.env.TTS_ENABLED !== 'false';
const TTS_LANG = process.env.TTS_LANG || 'vi';
const TTS_NATIVE_FALLBACK_ENABLED = process.env.TTS_NATIVE_FALLBACK_ENABLED !== 'false';

let speechQueue = Promise.resolve();

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
    fileStream.on('finish', () => { fileStream.close(); resolve(outputPath); });
    fileStream.on('error', (err) => { fs.unlink(outputPath, () => {}); reject(err); });
  });

  request.on('error', reject);
  request.on('timeout', () => { request.destroy(); reject(new Error('Google TTS timeout')); });
});

const playAudio = (filePath) => new Promise((resolve, reject) => {
  const platform = os.platform();

  if (platform === 'darwin') {
    exec(`afplay "${filePath}"`, { timeout: TTS_TIMEOUT_MS }, (err) => {
      fs.unlink(filePath, () => {});
      err ? reject(err) : resolve();
    });
    return;
  }

  if (platform === 'linux') {
    exec(
      `aplay "${filePath}" 2>/dev/null || mpg123 "${filePath}" 2>/dev/null || ffplay -nodisp -autoexit "${filePath}" 2>/dev/null`,
      { timeout: TTS_TIMEOUT_MS },
      (err) => { fs.unlink(filePath, () => {}); err ? reject(err) : resolve(); }
    );
    return;
  }

  if (platform === 'win32') {
    const winFilePath = filePath.replace(/\//g, '\\');
    const vbsPath = filePath.replace(/\.mp3$/, '.vbs');

    const vbsContent = [
      'Set wmp = CreateObject("WMPlayer.OCX")',
      `wmp.URL = "${winFilePath}"`,
      'wmp.controls.play',
      'Do While wmp.playState <> 1',  
      '  WScript.Sleep 200',
      'Loop',
      'wmp.close',
    ].join('\r\n');

    fs.writeFile(vbsPath, vbsContent, (writeErr) => {
      if (writeErr) {
        fs.unlink(filePath, () => {});
        reject(writeErr);
        return;
      }

      execFile('mshta.exe', [`vbscript:Execute("CreateObject(""Scripting.FileSystemObject"")") `], 
        { timeout: 1 }, () => {}); 

      exec(`cscript //NoLogo //B "${vbsPath}"`, { timeout: TTS_TIMEOUT_MS }, (err) => {
        fs.unlink(filePath, () => {});
        fs.unlink(vbsPath, () => {});
        err ? reject(err) : resolve();
      });
    });
    return;
  }

  reject(new Error(`Không hỗ trợ phát audio trên OS: ${platform}`));
});

const speakNativeFallback = (text) => new Promise((resolve, reject) => {
  const platform = os.platform();

  if (platform === 'win32') {
    const safeText = text.replace(/"/g, '').replace(/'/g, '');
    const vbsPath = path.join(os.tmpdir(), `tts_sapi_${Date.now()}.vbs`);
    const vbsContent = [
      'Set sapi = CreateObject("SAPI.SpVoice")',
      `sapi.Speak "${safeText}"`,
    ].join('\r\n');

    fs.writeFile(vbsPath, vbsContent, (writeErr) => {
      if (writeErr) { reject(writeErr); return; }
      exec(`cscript //NoLogo //B "${vbsPath}"`, { timeout: TTS_TIMEOUT_MS }, (err) => {
        fs.unlink(vbsPath, () => {});
        err ? reject(err) : resolve();
      });
    });
    return;
  }

  if (platform === 'darwin') {
    exec(`say "${text.replace(/"/g, '')}"`, { timeout: TTS_TIMEOUT_MS }, (err) => {
      err ? reject(err) : resolve();
    });
    return;
  }

  exec(`espeak "${text.replace(/"/g, '')}" 2>/dev/null`, { timeout: TTS_TIMEOUT_MS }, (err) => {
    err ? reject(err) : resolve();
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
    logger.warn(`Google TTS thất bại: ${googleError.message}. Thử fallback native...`);
  }

  if (!TTS_NATIVE_FALLBACK_ENABLED) {
    logger.error('Google TTS thất bại và fallback native đang tắt (TTS_NATIVE_FALLBACK_ENABLED=false)');
    return;
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

const speakCallTicket = (displayNumber, serviceName) => {
  const message = `Mời ông bà số ${displayNumber} đến quầy ${serviceName}`;
  return speak(message).catch((err) => {
    logger.error(`Không thể đọc số: ${err.message}`);
  });
};

module.exports = { speak, speakCallTicket };