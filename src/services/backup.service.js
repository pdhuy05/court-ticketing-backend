const fs = require('fs/promises');
const path = require('path');
const Backup = require('../models/backup.model');
const ApiError = require('../utils/ApiError');

const getBackupList = async () => {
    return Backup.find().sort({ createdAt: -1 }).lean();
};

const getBackupById = async (backupId) => {
    const backup = await Backup.findById(backupId).lean();

    if (!backup) {
        throw new ApiError(404, 'Không tìm thấy bản backup');
    }

    return backup;
};

const getBackupFilePath = async (backupId) => {
    const backup = await Backup.findById(backupId).lean();

    if (!backup) {
        throw new ApiError(404, 'Không tìm thấy bản backup');
    }

    const absolutePath = path.isAbsolute(backup.filePath)
        ? backup.filePath
        : path.join(process.cwd(), backup.filePath);

    try {
        await fs.access(absolutePath);
    } catch {
        throw new ApiError(404, 'File backup không tồn tại trên hệ thống');
    }

    return {
        absolutePath,
        fileName: backup.fileName,
        backup
    };
};

const deleteBackup = async (backupId) => {
    const backup = await Backup.findById(backupId);

    if (!backup) {
        throw new ApiError(404, 'Không tìm thấy bản backup');
    }

    const absolutePath = path.isAbsolute(backup.filePath)
        ? backup.filePath
        : path.join(process.cwd(), backup.filePath);

    try {
        await fs.unlink(absolutePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Không thể xoá file backup: ${error.message}`);
        }
    }

    await Backup.findByIdAndDelete(backupId);

    return { fileName: backup.fileName };
};

module.exports = {
    getBackupList,
    getBackupById,
    getBackupFilePath,
    deleteBackup
};
