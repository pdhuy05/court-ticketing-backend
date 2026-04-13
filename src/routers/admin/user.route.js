const express = require('express');
const router = express.Router();

const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const UserAdminController = require('../../controllers/admin/user.controller');
const validate = require('../../middlewares/validate.middleware');
const {
  staffIdParamSchema,
  createStaffSchema,
  updateStaffSchema,
  assignCounterSchema
} = require('../../validations/user.validation');

// ====================================
// ADMIN STAFF MANAGEMENT
// ====================================
router.get('/staff', authMiddleware, adminOnly, UserAdminController.getAllStaff);
router.get('/staff/:id', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.getStaffById);
router.post('/staff', authMiddleware, adminOnly, validate(createStaffSchema), UserAdminController.createStaff);
router.put('/staff/:id', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), validate(updateStaffSchema), UserAdminController.updateStaff);
router.delete('/staff/:id', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.deleteStaff);
router.patch('/staff/:id/remove-counter', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.removeCounter);

// ====================================
// STAFF ACTIONS
// ====================================
router.patch('/staff/:id/assign-counter', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), validate(assignCounterSchema), UserAdminController.assignCounter);
router.patch('/staff/:id/toggle-active', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.toggleActive);

module.exports = router;
