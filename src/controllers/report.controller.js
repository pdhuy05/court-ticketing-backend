const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { exportExcel, exportCsv, exportPdf } = require('../services/report.service');
const auditService = require('../services/audit.service');

// ─── Shared param parser ─────────────────────────────────────────────────────
const parseFilters = (query) => {
  const { startDate, endDate, reportType = 'all', status, serviceId, counterId, topN } = query;

  if (!startDate || !endDate)
    throw new ApiError(400, 'Tham số startDate và endDate là bắt buộc (YYYY-MM-DD)');
  if (startDate > endDate)
    throw new ApiError(400, 'startDate không được lớn hơn endDate');

  return {
    startDate,
    endDate,
    reportType,
    status:    status    || undefined,
    serviceId: serviceId || undefined,
    counterId: counterId || undefined,
    topN: topN ? Math.min(parseInt(topN, 10) || 20, 200) : 20,
  };
};

const buildFilename = (filters, ext) => {
  const type = filters.reportType !== 'all' ? `-${filters.reportType}` : '';
  return `bao-cao${type}-${filters.startDate}_${filters.endDate}.${ext}`;
};

// ─── Helper: ghi audit log sau mỗi lần export ────────────────────────────────
const logExport = (req, filters, format, status = 'success') => {
  auditService.log({
    req,
    action: 'REPORT_EXPORT',
    status,
    targetType: 'report',
    detail: {
      format,
      reportType: filters.reportType,
      startDate:  filters.startDate,
      endDate:    filters.endDate,
      topN:       filters.topN,
      status:     filters.status,
    },
  });
};

// ─── Excel ───────────────────────────────────────────────────────────────────
exports.exportExcel = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const workbook = await exportExcel(filters);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(filters, 'xlsx')}"`);
  await workbook.xlsx.write(res);
  res.end();
  logExport(req, filters, 'excel');
});

// ─── CSV ─────────────────────────────────────────────────────────────────────
exports.exportCsv = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const csv = await exportCsv(filters);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(filters, 'csv')}"`);
  res.send(csv);
  logExport(req, filters, 'csv');
});

// ─── PDF ─────────────────────────────────────────────────────────────────────
exports.exportPdf = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const pdfBuffer = await exportPdf(filters);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(filters, 'pdf')}"`);
  res.send(pdfBuffer);
  logExport(req, filters, 'pdf');
});