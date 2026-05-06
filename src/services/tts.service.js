const { exec, spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/Logger'); // Giả sử bạn có logger này, nếu không thì comment hoặc thay bằng console

const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS || 10000);
const TTS_ENABLED = process.env.TTS_ENABLED !== 'false';
const TTS_LANG = process.env.TTS_LANG || 'vi';
const TTS_NATIVE_FALLBACK_ENABLED = process.env.TTS_NATIVE_FALLBACK_ENABLED
  ? process.env.TTS_NATIVE_FALLBACK_ENABLED === 'true'
  : os.platform() !== 'win32';

const CACHE_MAX = 100;
const audioCache = new Map();
const downloadInFlight = new Map();

let speechQueue = Promise.resolve();

// ---------- Tối ưu Windows: giữ một PowerShell process duy nhất ----------
let powerShellProcess = null;
let psStdin = null;
let psReady = false;
let psStdoutBuffer = '';
let pendingPlayResolvers = [];

const initPowerShell = () => {
  if (powerShellProcess && psReady) return Promise.resolve();
  if (powerShellProcess && !psReady) {
    // đang khởi tạo, chờ
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (psReady) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });
  }
  return new Promise((resolve, reject) => {
    powerShellProcess = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-Command', '-'
    ]);
    psStdin = powerShellProcess.stdin;
    psReady = false;
    psStdoutBuffer = '';

    powerShellProcess.stdout.on('data', (data) => {
      psStdoutBuffer += data.toString();
      let lines = psStdoutBuffer.split('\n');
      psStdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === 'READY') {
          psReady = true;
          resolve();
        } else if (trimmed === 'DONE') {
          const resolver = pendingPlayResolvers.shift();
          if (resolver) resolver();
        }
      }
    });

    powerShellProcess.stderr.on('data', (data) => {
      logger.warning(`PowerShell stderr: ${data.toString()}`);
    });

    powerShellProcess.on('exit', (code) => {
      logger.warning(`PowerShell process exited with code ${code}`);
      powerShellProcess = null;
      psReady = false;
      psStdin = null;
      while (pendingPlayResolvers.length) {
        const rejector = pendingPlayResolvers.shift();
        if (rejector) rejector(new Error('PowerShell process died'));
      }
    });

    // SCRIPT ĐÃ SỬA: dùng nháy đơn cho đường dẫn, không có backtick rối
    const initScript = `
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinMCI {
  [DllImport("winmm.dll", CharSet=CharSet.Auto)]
  public static extern int mciSendString(string cmd, StringBuilder ret, int len, IntPtr hwnd);
}
"@
function Play-MP3([string]$path) {
  $fixedPath = $path -replace '/', '\\'
  [WinMCI]::mciSendString("open '$fixedPath' type mpegvideo alias tts", $null, 0, [IntPtr]::Zero) | Out-Null
  [WinMCI]::mciSendString("play tts wait", $null, 0, [IntPtr]::Zero) | Out-Null
  [WinMCI]::mciSendString("close tts", $null, 0, [IntPtr]::Zero) | Out-Null
  Write-Host "DONE"
}
Write-Host "READY"
`;
    psStdin.write(initScript + '\n');
    const timeout = setTimeout(() => {
      if (!psReady) {
        reject(new Error('PowerShell init timeout'));
      }
    }, 5000);
    const originalResolve = resolve;
    resolve = (val) => {
      clearTimeout(timeout);
      originalResolve(val);
    };
  });
};

const playBufferOnWindows = (buffer) => {
  return new Promise(async (resolve, reject) => {
    const tmpMp3 = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    fs.writeFile(tmpMp3, buffer, async (writeErr) => {
      if (writeErr) {
        reject(writeErr);
        return;
      }
      try {
        await initPowerShell();
        if (!psReady || !psStdin) {
          throw new Error('PowerShell not ready');
        }
        const mp3Path = tmpMp3.replace(/\//g, '\\');
        // Đưa resolver vào hàng đợi
        const donePromise = new Promise((res, rej) => {
          const timeoutId = setTimeout(() => {
            const idx = pendingPlayResolvers.findIndex(r => r === doneResolver);
            if (idx !== -1) pendingPlayResolvers.splice(idx, 1);
            fs.unlink(tmpMp3, () => {});
            rej(new Error('Play timeout'));
          }, TTS_TIMEOUT_MS);
          const doneResolver = () => {
            clearTimeout(timeoutId);
            res();
          };
          pendingPlayResolvers.push(doneResolver);
        });
        psStdin.write(`Play-MP3 '${mp3Path}'\n`);
        await donePromise;
        resolve();
      } catch (err) {
        fs.unlink(tmpMp3, () => {});
        reject(err);
      }
    });
  });
};
// ---------- Kết thúc tối ưu Windows ----------

const sanitizeText = (text = '') => String(text).replace(/"/g, '\\"').replace(/'/g, "\\'").trim();

const fetchGoogleTTS = (text) =>
  new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${TTS_LANG}&client=tw-ob`;
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://translate.google.com/',
      },
      timeout: TTS_TIMEOUT_MS,
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Google TTS status ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Google TTS timeout')); });
  });

const getAudioBuffer = (text) => {
  const cached = audioCache.get(text);
  if (cached) {
    logger.info(`TTS cache hit: "${text}"`);
    return Promise.resolve(cached);
  }
  if (downloadInFlight.has(text)) {
    logger.info(`TTS dedup download: "${text}"`);
    return downloadInFlight.get(text);
  }
  logger.info(`TTS download: "${text}"`);
  const promise = fetchGoogleTTS(text)
    .then((buffer) => {
      if (audioCache.size >= CACHE_MAX) audioCache.delete(audioCache.keys().next().value);
      audioCache.set(text, buffer);
      return buffer;
    })
    .finally(() => downloadInFlight.delete(text));
  downloadInFlight.set(text, promise);
  return promise;
};

const playBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const platform = os.platform();
    if (platform === 'win32') {
      return playBufferOnWindows(buffer).then(resolve).catch(reject);
    }
    const tmpMp3 = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    fs.writeFile(tmpMp3, buffer, (writeErr) => {
      if (writeErr) { reject(writeErr); return; }
      let command;
      switch (platform) {
        case 'darwin':
          command = `afplay "${tmpMp3}"`;
          break;
        case 'linux':
          command = `aplay "${tmpMp3}" 2>/dev/null || mpg123 "${tmpMp3}" 2>/dev/null || ffplay -nodisp -autoexit "${tmpMp3}" 2>/dev/null`;
          break;
        default:
          fs.unlink(tmpMp3, () => {});
          reject(new Error(`Không hỗ trợ phát audio trên OS: ${platform}`));
          return;
      }
      exec(command, { timeout: TTS_TIMEOUT_MS }, (error) => {
        fs.unlink(tmpMp3, () => {});
        if (error) reject(error); else resolve();
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
      case 'darwin': command = `say "${escaped}"`; break;
      case 'linux':  command = `espeak "${escaped}" 2>/dev/null`; break;
      default: reject(new Error(`OS not supported: ${platform}`)); return;
    }
    exec(command, { timeout: TTS_TIMEOUT_MS }, (err) => { if (err) reject(err); else resolve(); });
  });

const speak = (text) => {
  if (!TTS_ENABLED) { logger.info('TTS đang bị tắt'); return Promise.resolve(); }
  if (!text || !text.trim()) return Promise.resolve();

  const downloadPromise = getAudioBuffer(text).catch((err) => {
    logger.warning(`Google TTS download thất bại: ${err.message}`);
    return null;
  });

  const task = speechQueue
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

  speechQueue = task.catch(() => {});
  return task;
};

const speakCallTicket = (displayNumber, counterName) => {
  const message = `Mời ông bà số ${displayNumber} đến ${counterName}`;
  return speak(message).catch((error) => {
    logger.error(`Không thể đọc số: ${error.message}`);
  });
};

process.on('exit', () => {
  if (powerShellProcess) {
    powerShellProcess.kill();
  }
});

module.exports = { speak, speakCallTicket };