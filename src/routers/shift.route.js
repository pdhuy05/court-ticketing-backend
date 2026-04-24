const express = require('express');

const router = express.Router();
const { authMiddleware, staffOnly } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { endShiftSchema } = require('../validations/shift.validation');
const ShiftController = require('../controllers/shift.controller');

router.get('/status', authMiddleware, staffOnly, ShiftController.getMyShiftStatus);
router.get('/history', authMiddleware, staffOnly, ShiftController.getMyShiftHistory);
router.post('/start', authMiddleware, staffOnly, ShiftController.startShift);
router.post('/end', authMiddleware, staffOnly, validate(endShiftSchema), ShiftController.endShift);

module.exports = router;
