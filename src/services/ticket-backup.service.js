const fs = require('fs/promises');
const path = require('path');
const Backup = require('../models/backup.model');

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'ticket-resets');

const sanitizeSegment = (value) => {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const createBackupFileName = ({ type, label }) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sanitizeSegment(type)}-${sanitizeSegment(label)}-${timestamp}.json`;
};

const writeBackup = async ({ type, label, payload }) => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const fileName = createBackupFileName({ type, label });
  const absolutePath = path.join(BACKUP_DIR, fileName);

  const content = JSON.stringify(
    {
      ...payload,
      backupType: type,
      backupLabel: label,
      backedUpAt: new Date().toISOString()
    },
    null,
    2
  );

  await fs.writeFile(absolutePath, content, 'utf8');

  const fileSize = Buffer.byteLength(content, 'utf8');

  try {
    await Backup.create({
      fileName,
      backupType: type,
      backupLabel: label,
      ticketCount: payload?.totals?.ticketCount || 0,
      filePath: path.relative(process.cwd(), absolutePath),
      fileSize,
      createdBy: payload?.actor || null,
      criteria: payload?.criteria || null
    });
  } catch (error) {
    console.error(`Lưu backup record vào DB thất bại: ${error.message}`);
  }

  return {
    fileName,
    absolutePath,
    relativePath: path.relative(process.cwd(), absolutePath)
  };
};

module.exports = {
  writeBackup
};
