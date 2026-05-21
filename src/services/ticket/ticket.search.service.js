const Ticket = require("../../models/ticket.model");
const { buildTicketPresentation } = require("./ticket.helpers");

/**
 * Tra cứu vé cho admin — hỗ trợ kết hợp nhiều tiêu chí.
 *
 * @param {object} filters
 * @param {string} [filters.phone]        - Số điện thoại (khớp một phần)
 * @param {string} [filters.name]         - Tên khách hàng (không phân biệt hoa thường)
 * @param {string} [filters.ticketNumber] - Số vé (ticketNumber hoặc displayNumber)
 * @param {string} [filters.date]         - Ngày cụ thể YYYY-MM-DD
 * @param {string} [filters.dateFrom]     - Từ ngày YYYY-MM-DD
 * @param {string} [filters.dateTo]       - Đến ngày YYYY-MM-DD
 * @param {string} [filters.status]       - Trạng thái vé
 * @param {string} [filters.serviceId]    - ID quầy dịch vụ
 * @param {string} [filters.counterId]    - ID phòng
 * @param {number} [filters.page=1]       - Trang hiện tại
 * @param {number} [filters.limit=20]     - Số kết quả mỗi trang
 */
const searchTickets = async (filters = {}) => {
  const {
    phone,
    name,
    ticketNumber,
    date,
    dateFrom,
    dateTo,
    status,
    serviceId,
    counterId,
    page = 1,
    limit = 20,
  } = filters;

  const query = {};

  if (phone) {
    query.phone = { $regex: phone.replace(/\D/g, ""), $options: "i" };
  }

  if (name) {
    query.name = { $regex: name.trim(), $options: "i" };
  }

  if (ticketNumber) {
    query.ticketNumber = { $regex: ticketNumber.trim(), $options: "i" };
  }

  if (date) {
    query.date = date;
  } else if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = dateFrom;
    if (dateTo) query.date.$lte = dateTo;
  }

  if (status) {
    query.status = status;
  }

  if (serviceId) {
    query.serviceId = serviceId;
  }

  if (counterId) {
    query.counterId = counterId;
  }

  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .populate("serviceId", "name code prefixNumber")
      .populate("queueCounterId", "name number")
      .populate("counterId", "name number")
      .populate("staffId", "fullName username")
      .populate("completedByStaffId", "fullName username")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(query),
  ]);

  const formattedTickets = tickets.map((ticket) => {
    const presentation = buildTicketPresentation(ticket);
    return {
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      displayNumber: presentation.displayNumber,
      formattedNumber: presentation.formattedNumber,
      date: ticket.date,
      status: ticket.status,
      name: ticket.name,
      phone: ticket.phone,
      service: ticket.serviceId
        ? { id: ticket.serviceId._id, name: ticket.serviceId.name, code: ticket.serviceId.code }
        : null,
      counter: ticket.counterId
        ? { id: ticket.counterId._id, name: ticket.counterId.name, number: ticket.counterId.number }
        : null,
      queueCounter: ticket.queueCounterId
        ? { id: ticket.queueCounterId._id, name: ticket.queueCounterId.name, number: ticket.queueCounterId.number }
        : null,
      staff: ticket.completedByStaffId
        ? { id: ticket.completedByStaffId._id, name: ticket.completedByStaffId.fullName }
        : ticket.staffId
          ? { id: ticket.staffId._id, name: ticket.staffId.fullName }
          : null,
      skipCount: ticket.skipCount || 0,
      note: ticket.note || null,
      waitingDuration: ticket.waitingDuration || 0,
      processingDuration: ticket.processingDuration || 0,
      totalDuration: ticket.totalDuration || 0,
      createdAt: ticket.createdAt,
      calledAt: ticket.calledAt,
      completedAt: ticket.completedAt,
      skippedAt: ticket.skippedAt,
    };
  });

  return {
    tickets: formattedTickets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

module.exports = { searchTickets };