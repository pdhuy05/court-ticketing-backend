const asyncHandler = require("../utils/asyncHandler");
const dashboardService = require("../services/dashboard.service");

const getTicketsOverview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getTicketsOverview();
  dashboardService.emitTicketsOverview(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy thống kê tổng quan vé thành công",
  });
});

const getCountersStatus = asyncHandler(async (req, res) => {
  const data = await dashboardService.getCountersStatus();
  dashboardService.emitCountersStatus(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy trạng thái phòng/quầy thành công",
  });
});

const getStaffList = asyncHandler(async (req, res) => {
  const data = await dashboardService.getStaffList();
  dashboardService.emitStaffList(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy danh sách nhân viên thành công",
  });
});

const getTicketsToday = asyncHandler(async (req, res) => {
  const data = await dashboardService.getTicketsToday();
  dashboardService.emitTicketsToday(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy thống kê vé hôm nay thành công",
  });
});

const getRecentTickets = asyncHandler(async (req, res) => {
  const data = await dashboardService.getRecentTickets();
  dashboardService.emitRecentTickets(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy vé gần nhất thành công",
  });
});

const getTicketRatio = asyncHandler(async (req, res) => {
  const data = await dashboardService.getTicketRatio();
  dashboardService.emitTicketRatio(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy tỷ lệ vé theo phòng/quầy thành công",
  });
});

const getTicketTrend = asyncHandler(async (req, res) => {
  const { groupBy = "day" } = req.query;
  const data = await dashboardService.getTicketTrend(groupBy);
  dashboardService.emitTicketTrend(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy xu hướng vé theo thời gian thành công",
  });
});

const getCounterAlerts = asyncHandler(async (req, res) => {
  const data = await dashboardService.getCounterAlerts();
  dashboardService.emitCounterAlerts(data);

  res.status(200).json({
    success: true,
    data,
    message: "Lấy cảnh báo quầy quá tải thành công",
  });
});

module.exports = {
  getTicketsOverview,
  getCountersStatus,
  getStaffList,
  getTicketsToday,
  getRecentTickets,
  getTicketRatio,
  getTicketTrend,
  getCounterAlerts,
};
