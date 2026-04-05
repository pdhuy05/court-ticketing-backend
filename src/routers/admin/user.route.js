const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const UserAdminController = require('../../controllers/admin/user.controller');

router.use(authMiddleware, adminOnly);

router.get('/staff', UserAdminController.getAllStaff);
router.get('/staff/:id', UserAdminController.getStaffById);
router.post('/staff', UserAdminController.createStaff);
router.put('/staff/:id', UserAdminController.updateStaff);
router.delete('/staff/:id', UserAdminController.deleteStaff);
router.patch('/staff/:id/assign-counter', UserAdminController.assignCounter);
router.patch('/staff/:id/toggle-active', UserAdminController.toggleActive);

module.exports = router;