const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  patchSelfManageEnabledSchema,
  patchAutoStartTimeSchema,
  patchReminderMinutesSchema,
  adminEndShiftSchema,
  upsertServiceScheduleSchema,
  toggleScheduleSchema
} = require('../../validations/shift.validation');
const AdminShiftController = require('../../controllers/admin/shift.controller');

router.get('/settings', authMiddleware, adminOnly, AdminShiftController.getShiftSettings);
router.patch('/settings/self-manage', authMiddleware, adminOnly, validate(patchSelfManageEnabledSchema), AdminShiftController.patchSelfManageEnabled);
router.patch('/settings/auto-start-time', authMiddleware, adminOnly, validate(patchAutoStartTimeSchema), AdminShiftController.patchAutoStartTime);
router.patch('/settings/reminder-minutes', authMiddleware, adminOnly, validate(patchReminderMinutesSchema), AdminShiftController.patchReminderMinutes);
router.get('/staff', authMiddleware, adminOnly, AdminShiftController.getAllStaffShiftStatus);
router.get('/staff/on-duty', authMiddleware, adminOnly, AdminShiftController.getOnDutyStaff);
router.get('/staff/off-duty', authMiddleware, adminOnly, AdminShiftController.getOffDutyStaff);
router.get('/staff/:staffId/history', authMiddleware, adminOnly, AdminShiftController.getStaffShiftHistory);
router.post('/staff/:staffId/start', authMiddleware, adminOnly, AdminShiftController.adminStartShift);
router.post('/staff/:staffId/end', authMiddleware, adminOnly, validate(adminEndShiftSchema), AdminShiftController.adminEndShift);
router.get('/service-schedules', authMiddleware, adminOnly, AdminShiftController.getServiceSchedules);
router.post('/service-schedules', authMiddleware, adminOnly, validate(upsertServiceScheduleSchema), AdminShiftController.upsertServiceSchedule);
router.delete('/service-schedules/:serviceId', authMiddleware, adminOnly, AdminShiftController.deleteServiceSchedule);
router.patch('/service-schedules/:serviceId/toggle', authMiddleware, adminOnly, validate(toggleScheduleSchema), AdminShiftController.toggleServiceSchedule);

module.exports = router;
