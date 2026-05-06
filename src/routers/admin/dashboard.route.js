const express = require('express');
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const adminDashboardController = require('../../controllers/admin/dashboard.controller');
const dashboardController = require('../../controllers/dashboard.controller');
const { overviewQuerySchema, reportQuerySchema } = require('../../validations/admin-dashboard.validation');
const adminRouter = express.Router();
const publicRouter = express.Router();

adminRouter.get('/overview', authMiddleware, adminOnly, validate(overviewQuerySchema, 'query'), adminDashboardController.getOverview);
adminRouter.get('/reports', authMiddleware, adminOnly, validate(reportQuerySchema, 'query'), adminDashboardController.getReport);

publicRouter.get('/tickets/overview', dashboardController.getTicketsOverview);
publicRouter.get('/counters/status', dashboardController.getCountersStatus);
publicRouter.get('/staff', dashboardController.getStaffList);
publicRouter.get('/tickets/today', dashboardController.getTicketsToday);
publicRouter.get('/tickets/recent', dashboardController.getRecentTickets);
publicRouter.get('/tickets/ratio', dashboardController.getTicketRatio);
publicRouter.get('/tickets/trend', dashboardController.getTicketTrend);
publicRouter.get('/counters/alert', dashboardController.getCounterAlerts);

module.exports = { adminRouter, publicRouter };