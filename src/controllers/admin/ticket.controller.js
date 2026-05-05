const ticketService = require("../../services/ticket.service");
const asyncHandler = require("../../utils/asyncHandler");

exports.resetTicketsByDate = asyncHandler(async (req, res) => {
  const result = await ticketService.resetTicketsByDate(
    req.body?.date,
    req.user,
  );

  res.json({
    success: true,
    data: result,
    message: `Đã reset dữ liệu ngày ${result.date} cho ${result.counterCount} phòng`,
  });
});

exports.resetAllTickets = asyncHandler(async (req, res) => {
  const result = await ticketService.resetAllTickets(req.user);

  res.json({
    success: true,
    data: result,
    message: `Đã reset bộ đếm của ${result.resetCount} phòng trong hệ thống`,
  });
});
