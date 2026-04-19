const statisticsService = require('../services/statistics.service');
const ApiError = require('../utils/ApiError');

exports.getDailyStatistics = async (req, res) => {
  const { date } = req.query;
  const doc = await statisticsService.getStatisticsByDate(date);

  if (!doc) {
    throw new ApiError(404, 'Không tìm thấy thống kê cho ngày này');
  }

  res.json({
    success: true,
    data: doc
  });
};

exports.getStatisticsRange = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (startDate > endDate) {
    throw new ApiError(400, 'startDate không được lớn hơn endDate');
  }

  const list = await statisticsService.getStatisticsByRange(startDate, endDate);

  res.json({
    success: true,
    count: list.length,
    data: list
  });
};
