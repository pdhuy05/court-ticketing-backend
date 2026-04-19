const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const StatisticsController = require('../controllers/statistics.controller');
const {
  dailyStatisticsQuerySchema,
  statisticsRangeQuerySchema
} = require('../validations/statistics.validation');

router.get(
  '/daily',
  authMiddleware,
  adminOnly,
  validate(dailyStatisticsQuerySchema, 'query'),
  StatisticsController.getDailyStatistics
);

router.get(
  '/range',
  authMiddleware,
  adminOnly,
  validate(statisticsRangeQuerySchema, 'query'),
  StatisticsController.getStatisticsRange
);

module.exports = router;
