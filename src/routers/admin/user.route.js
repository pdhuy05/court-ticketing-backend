const express = require('express');
const router = express.Router();

const { authMiddleware, adminOnly, requirePermission } = require('../../middlewares/auth.middleware');
const UserAdminController = require('../../controllers/admin/user.controller');
const validate = require('../../middlewares/validate.middleware');
const {
  staffIdParamSchema,
  createStaffSchema,
  updateStaffSchema,
  assignCounterSchema,
  assignStaffServicesSchema,
  createAdminSchema,
  updateAdminSchema,
} = require('../../validations/user.validation');

router.get('/staff',                      authMiddleware, adminOnly, UserAdminController.getAllStaff);
router.get('/staff/:id',                  authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.getStaffById);
router.post('/staff',                     authMiddleware, adminOnly, validate(createStaffSchema), UserAdminController.createStaff);
router.put('/staff/:id',                  authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), validate(updateStaffSchema), UserAdminController.updateStaff);
router.delete('/staff/:id',               authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.deleteStaff);
router.patch('/staff/:id/remove-counter', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.removeCounter);
router.get('/staff/:id/services',         authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.getStaffServices);
router.patch('/staff/:id/assign-counter', authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), validate(assignCounterSchema), UserAdminController.assignCounter);
router.put('/staff/:id/services',         authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), validate(assignStaffServicesSchema), UserAdminController.assignServices);
router.patch('/staff/:id/toggle-active',  authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.toggleActive);

router.get('/admins',                         authMiddleware, adminOnly, UserAdminController.getAllAdmins);
router.get('/admins/:id',                     authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.getAdminById);
router.post('/admins',                        authMiddleware, adminOnly, validate(createAdminSchema), UserAdminController.createAdmin);
router.put('/admins/:id',                     authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), validate(updateAdminSchema), UserAdminController.updateAdmin);
router.delete('/admins/:id',                  authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.deleteAdmin);
router.patch('/admins/:id/toggle-active',     authMiddleware, adminOnly, validate(staffIdParamSchema, 'params'), UserAdminController.toggleAdminActive);

router.get('/admins/:id/permissions',  authMiddleware, adminOnly, UserAdminController.getAdminPermissions);
router.put('/admins/:id/permissions',  authMiddleware, adminOnly, UserAdminController.updateAdminPermissions);

module.exports = router;