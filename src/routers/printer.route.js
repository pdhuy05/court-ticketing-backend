const express = require('express');
const router = express.Router();

const PrinterController = require('../controllers/printer.controller');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

// ====================================
// CHỨC NĂNG 
// ====================================
router.post('/:code/test', authMiddleware, adminOnly, PrinterController.testPrint);
router.get('/:code/status', authMiddleware, adminOnly, PrinterController.getStatus);
router.post('/print', authMiddleware, adminOnly, PrinterController.printTicket);

// ====================================
// ADMIN ROUTES 
// ====================================
router.get('/', authMiddleware, adminOnly, PrinterController.getAll);
router.get('/:id', authMiddleware, adminOnly, PrinterController.getById);
router.post('/', authMiddleware, adminOnly, PrinterController.create);
router.put('/:id', authMiddleware, adminOnly, PrinterController.update);
router.delete('/:id', authMiddleware, adminOnly, PrinterController.delete);

module.exports = router;