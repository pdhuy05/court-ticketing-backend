const dashboardService = require('../../services/dashboard.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.getOverview = async (req, res) => {
  const overview = await dashboardService.getOverview(req.query);

  res.json({
    success: true,
    data: overview
  });
};

exports.getReport = async (req, res) => {
  const report = await dashboardService.getReport(req.query);

  res.json({
    success: true,
    data: report
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});
