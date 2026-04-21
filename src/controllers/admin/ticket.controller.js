const ticketService = require('../../services/ticket.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.resetTicketsByDate = asyncHandler(async (req, res) => {
  const result = await ticketService.resetTicketsByDate(req.body?.date, req.user);

  res.json({
    success: true,
    data: result,
    message: `Đã reset ${result.deletedCount} ticket của ngày ${result.date}`
  });
});

exports.resetAllTickets = asyncHandler(async (req, res) => {
  const result = await ticketService.resetAllTickets(req.user);

  res.json({
    success: true,
    data: result,
    message: `Đã reset toàn bộ ${result.deletedCount} ticket trong hệ thống`
  });
});
