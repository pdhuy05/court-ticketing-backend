const path = require('path');
const FONT_REGULAR = path.join(__dirname, '../assets/fonts/Roboto-Regular.ttf');
const FONT_BOLD    = path.join(__dirname, '../assets/fonts/Roboto-Bold.ttf');

const Ticket = require('../models/ticket.model');
const { TicketStatus } = require('../constants/enums');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    if (typeof prefix === 'number' && prefix > 0) return `${prefix}${num}`;
    return num;
  }
  const counterNum = ticket.queueCounterId?.number || ticket.counterId?.number;
  if (counterNum) return `${String(counterNum).padStart(2, '0')}${num}`;
  return num;
};

const statusLabel = {
  [TicketStatus.WAITING]: 'Đang chờ',
  [TicketStatus.PROCESSING]: 'Đang xử lý',
  [TicketStatus.COMPLETED]: 'Hoàn thành',
  [TicketStatus.SKIPPED]: 'Bỏ qua',
};

const avg = (arr, key) => {
  const vals = arr.map((t) => t[key]).filter((v) => v > 0);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
};

// ─── Query Builder ───────────────────────────────────────────────────────────

/**
 * filters: {
 *   startDate, endDate,
 *   reportType: 'all' | 'longest_wait' | 'longest_process' | 'by_status' | 'by_service' | 'by_counter',
 *   status: 'WAITING'|'PROCESSING'|'COMPLETED'|'SKIPPED'|undefined,
 *   serviceId: string|undefined,
 *   counterId: string|undefined,
 *   topN: number (default 20, used for longest_wait/longest_process),
 * }
 */
const buildQuery = (filters) => {
  const query = { date: { $gte: filters.startDate, $lte: filters.endDate } };
  if (filters.status) query.status = filters.status;
  if (filters.serviceId) query.serviceId = filters.serviceId;
  if (filters.counterId) query.counterId = filters.counterId;
  return query;
};

const getTickets = async (filters) => {
  const query = buildQuery(filters);
  let q = Ticket.find(query)
    .populate('serviceId', 'name code prefixNumber')
    .populate('counterId', 'name number')
    .populate('queueCounterId', 'name number')
    .populate('completedByStaffId', 'fullName username');

  const { reportType, topN = 20 } = filters;

  if (reportType === 'longest_wait') {
    q = q.sort({ waitingDuration: -1 }).limit(topN);
  } else if (reportType === 'longest_process') {
    q = q.sort({ processingDuration: -1 }).limit(topN);
  } else {
    q = q.sort({ date: 1, createdAt: 1 });
  }

  return q.lean();
};

// ─── Excel Styling ───────────────────────────────────────────────────────────

const styleHeader = (row) => {
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

const styleDataRow = (row, isEven) => {
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

const addTitleRow = (ws, title, colCount) => {
  const titleRow = ws.addRow([title]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  titleRow.height = 36;
  ws.addRow([]);
};

// ─── Excel Sheets ─────────────────────────────────────────────────────────────

const buildTicketDetailSheet = (workbook, tickets, filters) => {
  const ws = workbook.addWorksheet('Chi tiết vé');
  ws.columns = [
    { key: 'stt', width: 6 }, { key: 'date', width: 13 }, { key: 'ticketNumber', width: 14 },
    { key: 'service', width: 22 }, { key: 'counter', width: 18 }, { key: 'customerName', width: 22 },
    { key: 'phone', width: 14 }, { key: 'status', width: 14 }, { key: 'createdAt', width: 20 },
    { key: 'calledAt', width: 20 }, { key: 'completedAt', width: 20 }, { key: 'waitingDur', width: 18 },
    { key: 'processingDur', width: 18 }, { key: 'totalDur', width: 18 }, { key: 'skipCount', width: 10 },
    { key: 'staff', width: 20 }, { key: 'note', width: 28 },
  ];

  const typeLabel = getReportTypeLabel(filters.reportType, filters.topN);
  addTitleRow(ws, `${typeLabel}  (${filters.startDate} → ${filters.endDate})`, ws.columns.length);
  const headerRow = ws.addRow([
    'STT', 'Ngày', 'Số vé', 'Dịch vụ', 'Phòng', 'Khách hàng', 'SĐT',
    'Trạng thái', 'Giờ lấy số', 'Giờ gọi', 'Giờ hoàn thành',
    'TG chờ', 'TG xử lý', 'Tổng TG', 'Lần bỏ qua', 'Nhân viên', 'Ghi chú'
  ]);
  styleHeader(headerRow);

  tickets.forEach((t, i) => {
    const row = ws.addRow([
      i + 1, t.date, getDisplayNumber(t),
      t.serviceId?.name || '—', t.counterId?.name || t.queueCounterId?.name || '—',
      t.name, t.phone, statusLabel[t.status] || t.status,
      formatDateTime(t.createdAt), formatDateTime(t.calledAt), formatDateTime(t.completedAt),
      formatDuration(t.waitingDuration), formatDuration(t.processingDuration), formatDuration(t.totalDuration),
      t.skipCount || 0, t.completedByStaffId?.fullName || '—', t.note || '',
    ]);
    styleDataRow(row, i % 2 === 0);
  });
};

const buildDailyStatsSheet = (workbook, tickets, filters) => {
  const ws = workbook.addWorksheet('Thống kê theo ngày');
  ws.columns = [
    { key: 'date', width: 14 }, { key: 'total', width: 12 }, { key: 'completed', width: 14 },
    { key: 'skipped', width: 12 }, { key: 'waiting', width: 12 }, { key: 'processing', width: 14 },
    { key: 'avgWait', width: 18 }, { key: 'avgProcess', width: 18 }, { key: 'avgTotal', width: 18 },
  ];
  addTitleRow(ws, `THỐNG KÊ THEO NGÀY  (${filters.startDate} → ${filters.endDate})`, ws.columns.length);
  const headerRow = ws.addRow([
    'Ngày', 'Tổng vé', 'Hoàn thành', 'Bỏ qua', 'Đang chờ', 'Đang xử lý',
    'TG chờ TB', 'TG xử lý TB', 'Tổng TG TB'
  ]);
  styleHeader(headerRow);

  const byDate = {};
  tickets.forEach((t) => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });

  Object.keys(byDate).sort().forEach((date, i) => {
    const list = byDate[date];
    const row = ws.addRow([
      date, list.length,
      list.filter((t) => t.status === TicketStatus.COMPLETED).length,
      list.filter((t) => t.status === TicketStatus.SKIPPED).length,
      list.filter((t) => t.status === TicketStatus.WAITING).length,
      list.filter((t) => t.status === TicketStatus.PROCESSING).length,
      formatDuration(avg(list, 'waitingDuration')),
      formatDuration(avg(list, 'processingDuration')),
      formatDuration(avg(list, 'totalDuration')),
    ]);
    styleDataRow(row, i % 2 === 0);
  });

  ws.addRow([]);
  const completed = tickets.filter((t) => t.status === TicketStatus.COMPLETED);
  const totalRow = ws.addRow([
    'TỔNG', tickets.length, completed.length,
    tickets.filter((t) => t.status === TicketStatus.SKIPPED).length,
    tickets.filter((t) => t.status === TicketStatus.WAITING).length,
    tickets.filter((t) => t.status === TicketStatus.PROCESSING).length,
    formatDuration(avg(completed, 'waitingDuration')),
    formatDuration(avg(completed, 'processingDuration')),
    formatDuration(avg(completed, 'totalDuration')),
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
    cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
};

const buildServiceStatsSheet = (workbook, tickets, filters) => {
  const ws = workbook.addWorksheet('Thống kê theo dịch vụ');
  ws.columns = [
    { key: 'stt', width: 6 }, { key: 'service', width: 26 }, { key: 'total', width: 12 },
    { key: 'completed', width: 14 }, { key: 'skipped', width: 12 }, { key: 'waiting', width: 12 },
    { key: 'processing', width: 14 }, { key: 'rate', width: 16 }, { key: 'avgWait', width: 18 },
    { key: 'avgProcess', width: 18 },
  ];
  addTitleRow(ws, `THỐNG KÊ THEO DỊCH VỤ  (${filters.startDate} → ${filters.endDate})`, ws.columns.length);
  const headerRow = ws.addRow([
    'STT', 'Dịch vụ', 'Tổng vé', 'Hoàn thành', 'Bỏ qua',
    'Đang chờ', 'Đang xử lý', 'Tỷ lệ HT', 'TG chờ TB', 'TG xử lý TB'
  ]);
  styleHeader(headerRow);

  const byService = {};
  tickets.forEach((t) => {
    const key = String(t.serviceId?._id || 'unknown');
    if (!byService[key]) byService[key] = { name: t.serviceId?.name || 'Không xác định', list: [] };
    byService[key].list.push(t);
  });

  Object.values(byService).sort((a, b) => b.list.length - a.list.length).forEach(({ name, list }, i) => {
    const completed = list.filter((t) => t.status === TicketStatus.COMPLETED).length;
    const rate = list.length > 0 ? ((completed / list.length) * 100).toFixed(1) + '%' : '0%';
    const row = ws.addRow([
      i + 1, name, list.length, completed,
      list.filter((t) => t.status === TicketStatus.SKIPPED).length,
      list.filter((t) => t.status === TicketStatus.WAITING).length,
      list.filter((t) => t.status === TicketStatus.PROCESSING).length,
      rate, formatDuration(avg(list, 'waitingDuration')), formatDuration(avg(list, 'processingDuration')),
    ]);
    styleDataRow(row, i % 2 === 0);
  });
};

const buildCounterStatsSheet = (workbook, tickets, filters) => {
  const ws = workbook.addWorksheet('Thống kê theo quầy');
  ws.columns = [
    { key: 'stt', width: 6 }, { key: 'counter', width: 22 }, { key: 'total', width: 12 },
    { key: 'completed', width: 14 }, { key: 'skipped', width: 12 }, { key: 'rate', width: 16 },
    { key: 'avgWait', width: 18 }, { key: 'avgProcess', width: 18 }, { key: 'avgTotal', width: 18 },
  ];
  addTitleRow(ws, `THỐNG KÊ THEO QUẦY/PHÒNG  (${filters.startDate} → ${filters.endDate})`, ws.columns.length);
  const headerRow = ws.addRow([
    'STT', 'Phòng', 'Tổng vé xử lý', 'Hoàn thành', 'Bỏ qua',
    'Tỷ lệ HT', 'TG chờ TB', 'TG xử lý TB', 'Tổng TG TB'
  ]);
  styleHeader(headerRow);

  const handled = tickets.filter((t) => t.counterId);
  const byCounter = {};
  handled.forEach((t) => {
    const key = String(t.counterId._id || t.counterId);
    if (!byCounter[key]) byCounter[key] = { name: t.counterId?.name || 'Không xác định', list: [] };
    byCounter[key].list.push(t);
  });

  Object.values(byCounter).sort((a, b) => b.list.length - a.list.length).forEach(({ name, list }, i) => {
    const completed = list.filter((t) => t.status === TicketStatus.COMPLETED).length;
    const rate = list.length > 0 ? ((completed / list.length) * 100).toFixed(1) + '%' : '0%';
    const row = ws.addRow([
      i + 1, name, list.length, completed,
      list.filter((t) => t.status === TicketStatus.SKIPPED).length,
      rate, formatDuration(avg(list, 'waitingDuration')),
      formatDuration(avg(list, 'processingDuration')), formatDuration(avg(list, 'totalDuration')),
    ]);
    styleDataRow(row, i % 2 === 0);
  });
};

// ─── Report type label ────────────────────────────────────────────────────────

const getReportTypeLabel = (reportType, topN = 20) => {
  switch (reportType) {
    case 'longest_wait':    return `TOP ${topN} VÉ CHỜ LÂU NHẤT`;
    case 'longest_process': return `TOP ${topN} VÉ XỬ LÝ LÂU NHẤT`;
    case 'by_status':       return 'DANH SÁCH VÉ THEO TRẠNG THÁI';
    case 'by_service':      return 'DANH SÁCH VÉ THEO DỊCH VỤ';
    case 'by_counter':      return 'DANH SÁCH VÉ THEO QUẦY';
    default:                return 'DANH SÁCH VÉ CHI TIẾT';
  }
};

// ─── Excel Export ─────────────────────────────────────────────────────────────

const exportExcel = async (filters) => {
  const tickets = await getTickets(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Court Ticket System';
  workbook.created = new Date();

  buildTicketDetailSheet(workbook, tickets, filters);

  // Full report gets all stats sheets; filtered reports only get detail
  if (!filters.reportType || filters.reportType === 'all') {
    buildDailyStatsSheet(workbook, tickets, filters);
    buildServiceStatsSheet(workbook, tickets, filters);
    buildCounterStatsSheet(workbook, tickets, filters);
  }

  return workbook;
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

const exportCsv = async (filters) => {
  const tickets = await getTickets(filters);

  const BOM = '\uFEFF';
  const headers = [
    'STT', 'Ngày', 'Số vé', 'Dịch vụ', 'Phòng', 'Khách hàng', 'SĐT',
    'Trạng thái', 'Giờ lấy số', 'Giờ gọi', 'Giờ hoàn thành',
    'TG chờ (giây)', 'TG xử lý (giây)', 'Tổng TG (giây)', 'Lần bỏ qua', 'Nhân viên', 'Ghi chú'
  ];

  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = tickets.map((t, i) => [
    i + 1, t.date, getDisplayNumber(t),
    t.serviceId?.name || '', t.counterId?.name || t.queueCounterId?.name || '',
    t.name, t.phone, statusLabel[t.status] || t.status,
    formatDateTime(t.createdAt), formatDateTime(t.calledAt), formatDateTime(t.completedAt),
    t.waitingDuration || 0, t.processingDuration || 0, t.totalDuration || 0,
    t.skipCount || 0, t.completedByStaffId?.fullName || '', t.note || '',
  ].map(escape).join(','));

  return BOM + [headers.join(','), ...rows].join('\r\n');
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

const exportPdf = async (filters) => {
  const tickets = await getTickets(filters);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });

    // ── Register Vietnamese-capable fonts ──
    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold',    FONT_BOLD);

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const margin = 36;
    const contentW = pageW - margin * 2;

    // ── Title ──
    const typeLabel = getReportTypeLabel(filters.reportType, filters.topN);
    doc.font('Bold').fontSize(16).fillColor('#1e3a8a')
      .text(typeLabel, margin, margin, { align: 'center', width: contentW });
    doc.font('Regular').fontSize(10).fillColor('#64748b')
      .text(`Kỳ: ${filters.startDate} -> ${filters.endDate}  |  Tổng: ${tickets.length} ve`, margin, doc.y + 4, { align: 'center', width: contentW });
    doc.moveDown(0.8);

    // ── Table columns ──
    const cols = [
      { label: 'STT',        w: 30,  key: (t, i) => i + 1,                                              align: 'center' },
      { label: 'Ngày',       w: 70,  key: (t)    => t.date,                                              align: 'center' },
      { label: 'Số vé',      w: 55,  key: (t)    => getDisplayNumber(t),                                 align: 'center' },
      { label: 'Dịch vụ',   w: 110, key: (t)    => t.serviceId?.name || '—' },
      { label: 'Phòng',      w: 80,  key: (t)    => t.counterId?.name || t.queueCounterId?.name || '—' },
      { label: 'Khách hàng', w: 90,  key: (t)    => t.name },
      { label: 'Trạng thái', w: 70,  key: (t)    => statusLabel[t.status] || t.status,                   align: 'center' },
      { label: 'TG chờ',     w: 75,  key: (t)    => formatDuration(t.waitingDuration),                   align: 'center' },
      { label: 'TG xử lý',  w: 75,  key: (t)    => formatDuration(t.processingDuration),                align: 'center' },
      { label: 'Nhân viên',  w: 90,  key: (t)    => t.completedByStaffId?.fullName || '—' },
    ];

    const ROW_H = 20;
    const HEADER_H = 24;

    const drawTableHeader = (startY) => {
      doc.rect(margin, startY, contentW, HEADER_H).fill('#2563eb');
      let x = margin;
      cols.forEach((col) => {
        doc.font('Bold').fontSize(8).fillColor('#ffffff')
          .text(col.label, x + 3, startY + 7, { width: col.w - 6, align: col.align || 'left', lineBreak: false });
        x += col.w;
      });
      return startY + HEADER_H;
    };

    let y = doc.y;
    y = drawTableHeader(y);

    tickets.forEach((t, i) => {
      // page break
      if (y + ROW_H > doc.page.height - margin) {
        doc.addPage();
        y = margin;
        y = drawTableHeader(y);
      }

      const bg = i % 2 === 0 ? '#f0f4ff' : '#ffffff';
      doc.rect(margin, y, contentW, ROW_H).fill(bg);

      // row border
      doc.rect(margin, y, contentW, ROW_H).stroke('#d1d5db');

      let x = margin;
      cols.forEach((col) => {
        const val = String(col.key(t, i) ?? '—');
        doc.font('Regular').fontSize(7.5).fillColor('#1e293b')
          .text(val, x + 3, y + 6, { width: col.w - 6, align: col.align || 'left', lineBreak: false });
        x += col.w;
      });

      y += ROW_H;
    });

    // ── Summary ──
    doc.moveDown(1.5);
    const completed = tickets.filter((t) => t.status === TicketStatus.COMPLETED);
    doc.font('Regular').fontSize(10).fillColor('#1e293b')
      .text(
        `Tổng: ${tickets.length} ve  |  Hoan thanh: ${completed.length}  |  ` +
        `TG cho TB: ${formatDuration(avg(completed, 'waitingDuration'))}  |  ` +
        `TG Xử lý TB: ${formatDuration(avg(completed, 'processingDuration'))}`,
        margin, doc.y, { align: 'center', width: contentW }
      );

    doc.end();
  });
};

module.exports = { exportExcel, exportCsv, exportPdf };