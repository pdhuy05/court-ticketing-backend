const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const AdminBackupController = require('../../controllers/admin/backup.controller');

router.get('/', authMiddleware, adminOnly, AdminBackupController.getBackupList);
router.get('/:id', authMiddleware, adminOnly, AdminBackupController.getBackupById);
router.get('/:id/download', authMiddleware, adminOnly, AdminBackupController.downloadBackup);
router.delete('/:id', authMiddleware, adminOnly, AdminBackupController.deleteBackup);

module.exports = router;
