const dashboardService = require('../../services/dashboard.service');

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
