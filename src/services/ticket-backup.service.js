const fs = require('fs/promises');
const path = require('path');

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

  await fs.writeFile(
    absolutePath,
    JSON.stringify(
      {
        ...payload,
        backupType: type,
        backupLabel: label,
        backedUpAt: new Date().toISOString()
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    fileName,
    absolutePath,
    relativePath: path.relative(process.cwd(), absolutePath)
  };
};

module.exports = {
  writeBackup
};
