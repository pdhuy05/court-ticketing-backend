const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const DashboardController = require('../../controllers/admin/dashboard.controller');
const {
  overviewQuerySchema,
  reportQuerySchema
} = require('../../validations/admin-dashboard.validation');

router.get('/overview', authMiddleware, adminOnly, validate(overviewQuerySchema, 'query'), DashboardController.getOverview);
router.get('/reports', authMiddleware, adminOnly, validate(reportQuerySchema, 'query'), DashboardController.getReport);

module.exports = router;
