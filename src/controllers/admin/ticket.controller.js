const ticketService = require("../../services/ticket.service");
const { searchTickets } = require("../../services/ticket/ticket.search.service");
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

exports.searchTickets = asyncHandler(async (req, res) => {
  const result = await searchTickets({
    phone: req.query.phone,
    name: req.query.name,
    ticketNumber: req.query.ticketNumber,
    date: req.query.date,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    status: req.query.status,
    serviceId: req.query.serviceId,
    counterId: req.query.counterId,
    page: req.query.page ? parseInt(req.query.page) : 1,
    limit: req.query.limit ? parseInt(req.query.limit) : 20,
  });

  res.json({
    success: true,
    data: result.tickets,
    pagination: result.pagination,
    message: `Tìm thấy ${result.pagination.total} vé`,
  });
});