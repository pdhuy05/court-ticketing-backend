const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, staffOnly, counterStaff, staffOnDuty } = require('../middlewares/auth.middleware');
const {
  counterDisplayParamsSchema,
  cancelRecallTicketSchema,
  recallTicketParamsSchema,
  ticketIdParamSchema,
  createTicketSchema,
  callNextSchema,
  callByIdSchema,
  backToWaitingSchema,
  skipTicketSchema
} = require('../validations/ticket.validation');
const TicketController = require("../controllers/ticket.controller");

// ====================================
// PUBLIC ROUTES 
// ====================================
router.get("/waiting", TicketController.getAllWaiting);
router.get("/qr/:qrData", TicketController.getTicketByQR);
router.get("/counters/:counterId/display", validate(counterDisplayParamsSchema, 'params'), TicketController.getCounterDisplay);
router.post("/", validate(createTicketSchema), TicketController.create);
router.post("/:id/print", validate(ticketIdParamSchema, 'params'), TicketController.printTicket);

// ====================================
// STAFF ROUTES 
// ====================================
router.get("/my-counter", authMiddleware, staffOnly, counterStaff, TicketController.getMyCounter);
router.get("/staff/display", authMiddleware, staffOnly, counterStaff, TicketController.getStaffDisplay);
router.get("/recall-list", authMiddleware, staffOnly, counterStaff, TicketController.getRecallList);
router.post("/call-next", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(callNextSchema), TicketController.callNext);
router.post("/call-by-id", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(callByIdSchema), TicketController.callById);
router.post("/:id/recall", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(recallTicketParamsSchema, 'params'), TicketController.recallTicket);
router.post("/:id/recall-processing", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(recallTicketParamsSchema, 'params'), TicketController.recallProcessingTicket);
router.patch("/:id/cancel-recall", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(recallTicketParamsSchema, 'params'), validate(cancelRecallTicketSchema), TicketController.cancelRecallTicket);
router.patch("/:id/complete", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(ticketIdParamSchema, 'params'), TicketController.complete);
router.patch("/:id/back", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(ticketIdParamSchema, 'params'), validate(backToWaitingSchema), TicketController.backToWaiting);
router.patch("/:id/skip", authMiddleware, staffOnly, counterStaff, staffOnDuty, validate(ticketIdParamSchema, 'params'), validate(skipTicketSchema), TicketController.skip);

module.exports = router;
