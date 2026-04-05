const express = require('express');
const router = express.Router();
const PrinterController = require('../controllers/printer.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

// ==================== ADMIN ROUTES (cần auth) ====================
router.use(authMiddleware, adminOnly);

router.get('/', PrinterController.getAll);
router.get('/:id', PrinterController.getById);
router.post('/', PrinterController.create);
router.put('/:id', PrinterController.update);
router.delete('/:id', PrinterController.delete);

// ==================== CHỨC NĂNG ====================
router.post('/:code/test', PrinterController.testPrint);
router.get('/:code/status', PrinterController.getStatus);
router.post('/print', PrinterController.printTicket);

module.exports = router;