const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const DashboardController = require('../../controllers/admin/dashboard.controller');

router.get('/overview', authMiddleware, adminOnly, DashboardController.getOverview);

module.exports = router;
