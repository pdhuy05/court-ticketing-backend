const dashboardService = require('../../services/dashboard.service');

exports.getOverview = async (req, res) => {
  const overview = await dashboardService.getOverview();

  res.json({
    success: true,
    data: overview
  });
};
