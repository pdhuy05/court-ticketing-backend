const ticketService = require('../../services/ticket.service');

exports.resetTicketsByDate = async (req, res) => {
  const result = await ticketService.resetTicketsByDate(req.body.date);

  res.json({
    success: true,
    data: result,
    message: `Đã reset ${result.deletedCount} ticket của ngày ${result.date}`
  });
};

exports.resetAllTickets = async (req, res) => {
  const result = await ticketService.resetAllTickets();

  res.json({
    success: true,
    data: result,
    message: `Đã reset toàn bộ ${result.deletedCount} ticket trong hệ thống`
  });
};
