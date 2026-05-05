const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

// API 1: Tổng vé từ trước đến nay
router.get("/tickets/overview", dashboardController.getTicketsOverview);

// API 2: Thống kê Phòng/Quầy
router.get("/counters/status", dashboardController.getCountersStatus);

// API 3: Danh sách & thống kê nhân viên
router.get("/staff", dashboardController.getStaffList);

// API 4: Thống kê vé hôm nay
router.get("/tickets/today", dashboardController.getTicketsToday);

// API 5: Danh sách 5 vé gần nhất của mỗi phòng, mỗi quầy
router.get("/tickets/recent", dashboardController.getRecentTickets);

// API 6: Tỷ lệ vé theo phòng/quầy từ trước đến nay
router.get("/tickets/ratio", dashboardController.getTicketRatio);

// API 7: Số lượng vé theo thời gian
router.get("/tickets/trend", dashboardController.getTicketTrend);

// API 8: Cảnh báo quầy quá tải
router.get("/counters/alert", dashboardController.getCounterAlerts);

module.exports = router;
