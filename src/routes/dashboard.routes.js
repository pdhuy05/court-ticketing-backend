const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/tickets/overview", dashboardController.getTicketsOverview);
router.get("/counters/status", dashboardController.getCountersStatus);
router.get("/staff", dashboardController.getStaffList);
router.get("/tickets/today", dashboardController.getTicketsToday);
router.get("/tickets/recent", dashboardController.getRecentTickets);
router.get("/tickets/ratio", dashboardController.getTicketRatio);
router.get("/tickets/trend", dashboardController.getTicketTrend);
router.get("/counters/alert", dashboardController.getCounterAlerts);

module.exports = router;
