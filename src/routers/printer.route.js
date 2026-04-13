const express = require('express');
const router = express.Router();

const PrinterController = require('../controllers/printer.controller');
const validate = require('../middlewares/validate.middleware');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');
const {
  printerCodeParamSchema,
  printerIdParamSchema,
  createPrinterSchema,
  updatePrinterSchema,
  printTicketSchema
} = require('../validations/printer.validation');

// ====================================
// CHỨC NĂNG 
// ====================================
router.post('/:code/test', authMiddleware, adminOnly, validate(printerCodeParamSchema, 'params'), PrinterController.testPrint);
router.get('/:code/status', authMiddleware, adminOnly, validate(printerCodeParamSchema, 'params'), PrinterController.getStatus);
router.post('/print', authMiddleware, adminOnly, validate(printTicketSchema), PrinterController.printTicket);

// ====================================
// ADMIN ROUTES 
// ====================================
router.get('/', authMiddleware, adminOnly, PrinterController.getAll);
router.get('/:id', authMiddleware, adminOnly, validate(printerIdParamSchema, 'params'), PrinterController.getById);
router.post('/', authMiddleware, adminOnly, validate(createPrinterSchema), PrinterController.create);
router.put('/:id', authMiddleware, adminOnly, validate(printerIdParamSchema, 'params'), validate(updatePrinterSchema), PrinterController.update);
router.delete('/:id', authMiddleware, adminOnly, validate(printerIdParamSchema, 'params'), PrinterController.delete);

module.exports = router;
