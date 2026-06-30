const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');
const ReportController = require('../controllers/report.controller');

router.get('/export',        authMiddleware, adminOnly, ReportController.exportExcel);
router.get('/export/excel',  authMiddleware, adminOnly, ReportController.exportExcel);
router.get('/export/csv',    authMiddleware, adminOnly, ReportController.exportCsv);
router.get('/export/pdf',    authMiddleware, adminOnly, ReportController.exportPdf);

module.exports = router;