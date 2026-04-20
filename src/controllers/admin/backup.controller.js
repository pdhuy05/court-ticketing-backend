const backupService = require('../../services/backup.service');

exports.getBackupList = async (req, res) => {
    const backups = await backupService.getBackupList();

    res.json({
        success: true,
        data: backups,
        count: backups.length
    });
};

exports.getBackupById = async (req, res) => {
    const backup = await backupService.getBackupById(req.params.id);

    res.json({
        success: true,
        data: backup
    });
};

exports.downloadBackup = async (req, res) => {
    const { absolutePath, fileName } = await backupService.getBackupFilePath(req.params.id);

    res.download(absolutePath, fileName);
};

exports.deleteBackup = async (req, res) => {
    const result = await backupService.deleteBackup(req.params.id);

    res.json({
        success: true,
        data: result,
        message: `Đã xoá backup: ${result.fileName}`
    });
};
