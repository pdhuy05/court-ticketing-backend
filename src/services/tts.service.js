const { exec, spawn } = require('child_process');
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

// ---------- Hàng đợi phát nối tiếp ----------
let speechQueue = Promise.resolve();

// ---------- Tối ưu Windows: một PowerShell process dùng WMPlayer.OCX ----------
let powerShellProcess = null;
let psStdin = null;
let psReady = false;
let pendingPlayResolvers = []; // Mỗi lần gọi play sẽ thêm một resolver, được gọi khi có "DONE"

// Khởi tạo PowerShell process một lần duy nhất
const initPowerShell = () => {
  if (powerShellProcess && psReady) return Promise.resolve();
  if (powerShellProcess && !psReady) {
    // Đang khởi tạo, chờ
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (psReady) {
          clearInterval(interval);
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

    let stdoutBuffer = '';
    powerShellProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
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
      // Báo lỗi cho tất cả pending
      while (pendingPlayResolvers.length) {
        const rejector = pendingPlayResolvers.shift();
        if (rejector) rejector(new Error('PowerShell process died'));
      }
    });

    // Script định nghĩa hàm Play-MP3 dùng WMPlayer.OCX (chạy chắc chắn)
    const initScript = `
function Play-MP3([string]$path) {
  $wmp = New-Object -ComObject WMPlayer.OCX
  $wmp.settings.autoStart = $true
  $wmp.URL = $path
  $wmp.controls.play()
  # Chờ playState == 1 (stopped)
  while ($wmp.playState -ne 1) { Start-Sleep -Milliseconds 100 }
  $wmp.close()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wmp) | Out-Null
  Write-Host "DONE"
}
Write-Host "READY"
`;
    psStdin.write(initScript + '\n');
    const timeout = setTimeout(() => {
      if (!psReady) reject(new Error('PowerShell init timeout'));
    }, 5000);
    const originalResolve = resolve;
    resolve = (val) => {
      clearTimeout(timeout);
      originalResolve(val);
    };
  });
};

// Phát buffer MP3 trên Windows (không spawn process mới)
const playBufferOnWindows = (buffer) => {
  return new Promise(async (resolve, reject) => {
    const tmpMp3 = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    fs.writeFile(tmpMp3, buffer, async (err) => {
      if (err) return reject(err);
      try {
        await initPowerShell();
        if (!psReady || !psStdin) throw new Error('PowerShell not ready');
        const mp3Path = tmpMp3.replace(/\//g, '\\'); // backslash cho Windows
        // Tạo promise để chờ tín hiệu DONE
        const donePromise = new Promise((res, rej) => {
          const resolved = false;
          const timeoutId = setTimeout(() => {
            const idx = pendingPlayResolvers.findIndex(r => r === resolver);
            if (idx !== -1) pendingPlayResolvers.splice(idx, 1);
            fs.unlink(tmpMp3, () => {});
            rej(new Error('Play timeout'));
          }, TTS_TIMEOUT_MS);
          const resolver = () => {
            clearTimeout(timeoutId);
            fs.unlink(tmpMp3, () => {});
            res();
          };
          pendingPlayResolvers.push(resolver);
        });
        psStdin.write(`Play-MP3 '${mp3Path}'\n`);
        await donePromise;
        resolve();
      } catch (e) {
        fs.unlink(tmpMp3, () => {});
        reject(e);
      }
    });
  });
};

// ---------- Hàm tải Google TTS và xuất buffer (giữ nguyên cache) ----------
const audioCache = new Map();
const downloadInFlight = new Map();
const CACHE_MAX = 100;

const fetchGoogleTTS = (text) =>
  new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${TTS_LANG}&client=tw-ob`;
    const request = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/' },
      timeout: TTS_TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Google TTS status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Google TTS timeout')); });
  });

const getAudioBuffer = (text) => {
  const cached = audioCache.get(text);
  if (cached) return Promise.resolve(cached);
  if (downloadInFlight.has(text)) return downloadInFlight.get(text);
  const promise = fetchGoogleTTS(text)
    .then(buffer => {
      if (audioCache.size >= CACHE_MAX) audioCache.delete(audioCache.keys().next().value);
      audioCache.set(text, buffer);
      return buffer;
    })
    .finally(() => downloadInFlight.delete(text));
  downloadInFlight.set(text, promise);
  return promise;
};

// ---------- Play buffer theo platform ----------
const playBuffer = (buffer) => {
  const platform = os.platform();
  if (platform === 'win32') {
    return playBufferOnWindows(buffer);
  }
  // Các OS khác dùng exec như cũ (tạm thời)
  return new Promise((resolve, reject) => {
    const tmpMp3 = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    fs.writeFile(tmpMp3, buffer, (err) => {
      if (err) return reject(err);
      let command;
      if (platform === 'darwin') command = `afplay "${tmpMp3}"`;
      else if (platform === 'linux') command = `aplay "${tmpMp3}" 2>/dev/null || mpg123 "${tmpMp3}" 2>/dev/null || ffplay -nodisp -autoexit "${tmpMp3}" 2>/dev/null`;
      else return reject(new Error(`Unsupported OS: ${platform}`));
      exec(command, { timeout: TTS_TIMEOUT_MS }, (error) => {
        fs.unlink(tmpMp3, () => {});
        if (error) reject(error);
        else resolve();
      });
    });
  });
};

// ---------- Fallback native (giữ nguyên) ----------
const speakNativeFallback = (text) => new Promise((resolve, reject) => {
  const platform = os.platform();
  const escaped = text.replace(/"/g, '\\"').replace(/'/g, "\\'").trim();
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

// ---------- Hàm speak chính (có queue) ----------
const speak = (text) => {
  if (!TTS_ENABLED) { logger.info('TTS đang bị tắt'); return Promise.resolve(); }
  if (!text || !text.trim()) return Promise.resolve();

  const downloadPromise = getAudioBuffer(text).catch(err => {
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
  return speak(message).catch(error => logger.error(`Không thể đọc số: ${error.message}`));
};

// Dọn dẹp khi app tắt
process.on('exit', () => {
  if (powerShellProcess) powerShellProcess.kill();
});

module.exports = { speak, speakCallTicket };