const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');
const ReportController = require('../controllers/report.controller');

router.get('/export', authMiddleware, adminOnly,ReportController.exportExcel);

module.exports = router;