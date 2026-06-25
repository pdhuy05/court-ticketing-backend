const Ticket = require('../models/ticket.model');
const Service = require('../models/service.model');
const Counter = require('../models/counter.model');
const { TicketStatus } = require('../constants/enums');
const ExcelJS = require('exceljs');

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
};

const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const getDisplayNumber = (ticket) => {
  const num = String(ticket.number).padStart(3, '0');
  if (ticket.displayUsesServicePrefix === true) {
    const prefix = ticket.serviceId?.prefixNumber;
    if (typeof prefix === 'number' && prefix > 0) {
      return `${prefix}${num}`;
    }
    return num;
  }
  const counterNum = ticket.queueCounterId?.number || ticket.counterId?.number;
  if (counterNum) {
    return `${String(counterNum).padStart(2, '0')}${num}`;
  }
  return num;
};

const styleHeader = (worksheet, row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  });
  row.height = 28;
};

const styleDataRow = (worksheet, row, isEven) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: isEven ? 'FFF0F4FF' : 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };
  });
};

const addTitleRow = (worksheet, title, colCount) => {
  const titleRow = worksheet.addRow([title]);
  worksheet.mergeCells(titleRow.number, 1, titleRow.number, colCount);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  titleRow.height = 36;
  worksheet.addRow([]);
};

const buildDateQuery = (startDate, endDate) => ({
  date: { $gte: startDate, $lte: endDate }
});

const getTicketsInRange = (startDate, endDate) =>
  Ticket.find(buildDateQuery(startDate, endDate))
    .populate('serviceId', 'name code prefixNumber')
    .populate('counterId', 'name number')
    .populate('queueCounterId', 'name number')
    .populate('completedByStaffId', 'fullName username')
    .lean();

const buildTicketDetailSheet = async (workbook, tickets, startDate, endDate) => {
  const ws = workbook.addWorksheet('Chi tiết vé');

  ws.columns = [
    { key: 'stt', width: 6  },
    { key: 'date', width: 13 },
    { key: 'ticketNumber', width: 14 },
    { key: 'service', width: 22 },
    { key: 'counter', width: 18 },
    { key: 'customerName', width: 22 },
    { key: 'phone', width: 14 },
    { key: 'status', width: 14 },
    { key: 'createdAt', width: 20 },
    { key: 'calledAt', width: 20 },
    { key: 'completedAt', width: 20 },
    { key: 'waitingDur', width: 18 },
    { key: 'processingDur',  width: 18 },
    { key: 'totalDur', width: 18 },
    { key: 'skipCount', width: 10 },
    { key: 'staff', width: 20 },
    { key: 'note', width: 28 },
  ];

  addTitleRow(ws, `DANH SÁCH VÉ CHI TIẾT  (${startDate} → ${endDate})`, ws.columns.length);

  const headerRow = ws.addRow([
    'STT', 'Ngày', 'Số vé', 'Dịch vụ', 'Phòng', 'Khách hàng', 'SĐT',
    'Trạng thái', 'Giờ lấy số', 'Giờ gọi', 'Giờ hoàn thành',
    'TG chờ', 'TG xử lý', 'Tổng TG', 'Lần bỏ qua', 'Nhân viên', 'Ghi chú'
  ]);
  styleHeader(ws, headerRow);

  const statusLabel = {
    [TicketStatus.WAITING]: 'Đang chờ',
    [TicketStatus.PROCESSING]: 'Đang xử lý',
    [TicketStatus.COMPLETED]: 'Hoàn thành',
    [TicketStatus.SKIPPED]: 'Bỏ qua',
  };

  tickets.forEach((t, i) => {
    const row = ws.addRow([
      i + 1,
      t.date,
      getDisplayNumber(t),
      t.serviceId?.name || '—',
      t.counterId?.name || t.queueCounterId?.name || '—',
      t.name,
      t.phone,
      statusLabel[t.status] || t.status,
      formatDateTime(t.createdAt),
      formatDateTime(t.calledAt),
      formatDateTime(t.completedAt),
      formatDuration(t.waitingDuration),
      formatDuration(t.processingDuration),
      formatDuration(t.totalDuration),
      t.skipCount || 0,
      t.completedByStaffId?.fullName || '—',
      t.note || '',
    ]);
    styleDataRow(ws, row, i % 2 === 0);
  });
};


const buildDailyStatsSheet = async (workbook, tickets, startDate, endDate) => {
  const ws = workbook.addWorksheet('Thống kê theo ngày');

  ws.columns = [
    { key: 'date', width: 14 },
    { key: 'total', width: 12 },
    { key: 'completed', width: 14 },
    { key: 'skipped', width: 12 },
    { key: 'waiting', width: 12 },
    { key: 'processing', width: 14 },
    { key: 'avgWait', width: 18 },
    { key: 'avgProcess', width: 18 },
    { key: 'avgTotal', width: 18 },
  ];

  addTitleRow(ws, `THỐNG KÊ THEO NGÀY  (${startDate} → ${endDate})`, ws.columns.length);

  const headerRow = ws.addRow([
    'Ngày', 'Tổng vé', 'Hoàn thành', 'Bỏ qua',
    'Đang chờ', 'Đang xử lý',
    'TG chờ TB', 'TG xử lý TB', 'Tổng TG TB'
  ]);
  styleHeader(ws, headerRow);

  const byDate = {};
  tickets.forEach((t) => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });

  const avg = (arr, key) => {
    const vals = arr.map((t) => t[key]).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  Object.keys(byDate).sort().forEach((date, i) => {
    const list = byDate[date];
    const row = ws.addRow([
      date,
      list.length,
      list.filter((t) => t.status === TicketStatus.COMPLETED).length,
      list.filter((t) => t.status === TicketStatus.SKIPPED).length,
      list.filter((t) => t.status === TicketStatus.WAITING).length,
      list.filter((t) => t.status === TicketStatus.PROCESSING).length,
      formatDuration(avg(list, 'waitingDuration')),
      formatDuration(avg(list, 'processingDuration')),
      formatDuration(avg(list, 'totalDuration')),
    ]);
    styleDataRow(ws, row, i % 2 === 0);
  });

  ws.addRow([]);
  const completed = tickets.filter((t) => t.status === TicketStatus.COMPLETED);
  const avg2 = (key) => {
    const vals = completed.map((t) => t[key]).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };
  const totalRow = ws.addRow([
    'TỔNG',
    tickets.length,
    completed.length,
    tickets.filter((t) => t.status === TicketStatus.SKIPPED).length,
    tickets.filter((t) => t.status === TicketStatus.WAITING).length,
    tickets.filter((t) => t.status === TicketStatus.PROCESSING).length,
    formatDuration(avg2('waitingDuration')),
    formatDuration(avg2('processingDuration')),
    formatDuration(avg2('totalDuration')),
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
};

const buildServiceStatsSheet = async (workbook, tickets, startDate, endDate) => {
  const ws = workbook.addWorksheet('Thống kê theo dịch vụ');

  ws.columns = [
    { key: 'stt', width: 6  },
    { key: 'service', width: 26 },
    { key: 'total', width: 12 },
    { key: 'completed', width: 14 },
    { key: 'skipped', width: 12 },
    { key: 'waiting', width: 12 },
    { key: 'processing', width: 14 },
    { key: 'rate', width: 16 },
    { key: 'avgWait', width: 18 },
    { key: 'avgProcess', width: 18 },
  ];

  addTitleRow(ws, `THỐNG KÊ THEO DỊCH VỤ  (${startDate} → ${endDate})`, ws.columns.length);

  const headerRow = ws.addRow([
    'STT', 'Dịch vụ', 'Tổng vé', 'Hoàn thành', 'Bỏ qua',
    'Đang chờ', 'Đang xử lý', 'Tỷ lệ HT', 'TG chờ TB', 'TG xử lý TB'
  ]);
  styleHeader(ws, headerRow);

  const byService = {};
  tickets.forEach((t) => {
    const key = String(t.serviceId?._id || 'unknown');
    if (!byService[key]) byService[key] = { name: t.serviceId?.name || 'Không xác định', list: [] };
    byService[key].list.push(t);
  });

  const avg = (arr, key) => {
    const vals = arr.map((t) => t[key]).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  Object.values(byService)
    .sort((a, b) => b.list.length - a.list.length)
    .forEach(({ name, list }, i) => {
      const completed = list.filter((t) => t.status === TicketStatus.COMPLETED).length;
      const rate = list.length > 0 ? ((completed / list.length) * 100).toFixed(1) + '%' : '0%';
      const row = ws.addRow([
        i + 1, name, list.length, completed,
        list.filter((t) => t.status === TicketStatus.SKIPPED).length,
        list.filter((t) => t.status === TicketStatus.WAITING).length,
        list.filter((t) => t.status === TicketStatus.PROCESSING).length,
        rate,
        formatDuration(avg(list, 'waitingDuration')),
        formatDuration(avg(list, 'processingDuration')),
      ]);
      styleDataRow(ws, row, i % 2 === 0);
    });
};

const buildCounterStatsSheet = async (workbook, tickets, startDate, endDate) => {
  const ws = workbook.addWorksheet('Thống kê theo quầy');

  ws.columns = [
    { key: 'stt',         width: 6  },
    { key: 'counter',     width: 22 },
    { key: 'total',       width: 12 },
    { key: 'completed',   width: 14 },
    { key: 'skipped',     width: 12 },
    { key: 'rate',        width: 16 },
    { key: 'avgWait',     width: 18 },
    { key: 'avgProcess',  width: 18 },
    { key: 'avgTotal',    width: 18 },
  ];

  addTitleRow(ws, `THỐNG KÊ THEO QUẦY/PHÒNG  (${startDate} → ${endDate})`, ws.columns.length);

  const headerRow = ws.addRow([
    'STT', 'Phòng', 'Tổng vé xử lý', 'Hoàn thành', 'Bỏ qua',
    'Tỷ lệ HT', 'TG chờ TB', 'TG xử lý TB', 'Tổng TG TB'
  ]);
  styleHeader(ws, headerRow);

  const handled = tickets.filter((t) => t.counterId);
  const byCounter = {};
  handled.forEach((t) => {
    const key = String(t.counterId._id || t.counterId);
    if (!byCounter[key]) byCounter[key] = { name: t.counterId?.name || 'Không xác định', list: [] };
    byCounter[key].list.push(t);
  });

  const avg = (arr, key) => {
    const vals = arr.map((t) => t[key]).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  Object.values(byCounter)
    .sort((a, b) => b.list.length - a.list.length)
    .forEach(({ name, list }, i) => {
      const completed = list.filter((t) => t.status === TicketStatus.COMPLETED).length;
      const rate = list.length > 0 ? ((completed / list.length) * 100).toFixed(1) + '%' : '0%';
      const row = ws.addRow([
        i + 1, name, list.length, completed,
        list.filter((t) => t.status === TicketStatus.SKIPPED).length,
        rate,
        formatDuration(avg(list, 'waitingDuration')),
        formatDuration(avg(list, 'processingDuration')),
        formatDuration(avg(list, 'totalDuration')),
      ]);
      styleDataRow(ws, row, i % 2 === 0);
    });
};

const exportReport = async (startDate, endDate) => {
  const tickets = await getTicketsInRange(startDate, endDate);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Court Ticket System';
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  await buildTicketDetailSheet(workbook, tickets, startDate, endDate);
  await buildDailyStatsSheet(workbook, tickets, startDate, endDate);
  await buildServiceStatsSheet(workbook, tickets, startDate, endDate);
  await buildCounterStatsSheet(workbook, tickets, startDate, endDate);

  return workbook;
};

module.exports = { exportReport };