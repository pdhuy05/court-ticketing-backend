const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { exportReport } = require('../services/report.service');

exports.exportExcel = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ApiError(400, 'Tham số startDate và endDate là bắt buộc (YYYY-MM-DD)');
  }

  if (startDate > endDate) {
    throw new ApiError(400, 'startDate không được lớn hơn endDate');
  }

  const workbook = await exportReport(startDate, endDate);

  const filename = `bao-cao-${startDate}_${endDate}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
});