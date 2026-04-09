const express = require('express');
const router = express.Router();

const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const UserAdminController = require('../../controllers/admin/user.controller');

// ====================================
// ADMIN STAFF MANAGEMENT
// ====================================
router.get('/staff', authMiddleware, adminOnly, UserAdminController.getAllStaff);
router.get('/staff/:id', authMiddleware, adminOnly, UserAdminController.getStaffById);
router.post('/staff', authMiddleware, adminOnly, UserAdminController.createStaff);
router.put('/staff/:id', authMiddleware, adminOnly, UserAdminController.updateStaff);
router.delete('/staff/:id', authMiddleware, adminOnly, UserAdminController.deleteStaff);
router.patch('/staff/:id/remove-counter', authMiddleware, adminOnly, UserAdminController.removeCounter);

// ====================================
// STAFF ACTIONS
// ====================================
router.patch('/staff/:id/assign-counter', authMiddleware, adminOnly, UserAdminController.assignCounter);
router.patch('/staff/:id/toggle-active', authMiddleware, adminOnly, UserAdminController.toggleActive);

module.exports = router;