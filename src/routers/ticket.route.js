const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, staffOnly, counterStaff } = require('../middlewares/auth.middleware');
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

// ====================================
// STAFF ROUTES 
// ====================================
router.get("/my-counter", authMiddleware, staffOnly, counterStaff, TicketController.getMyCounter);
router.get("/staff/display", authMiddleware, staffOnly, counterStaff, TicketController.getStaffDisplay);
router.get("/recall-list", authMiddleware, staffOnly, counterStaff, TicketController.getRecallList);
router.post("/call-next", authMiddleware, staffOnly, counterStaff, validate(callNextSchema), TicketController.callNext);
router.post("/call-by-id", authMiddleware, staffOnly, counterStaff, validate(callByIdSchema), TicketController.callById);
router.post("/:id/recall", authMiddleware, staffOnly, counterStaff, validate(recallTicketParamsSchema, 'params'), TicketController.recallTicket);
router.post("/:id/recall-processing", authMiddleware, staffOnly, counterStaff, validate(recallTicketParamsSchema, 'params'), TicketController.recallProcessingTicket);
router.patch("/:id/cancel-recall", authMiddleware, staffOnly, counterStaff, validate(recallTicketParamsSchema, 'params'), validate(cancelRecallTicketSchema), TicketController.cancelRecallTicket);
router.patch("/:id/complete", authMiddleware, staffOnly, counterStaff, validate(ticketIdParamSchema, 'params'), TicketController.complete);
router.patch("/:id/back", authMiddleware, staffOnly, counterStaff, validate(ticketIdParamSchema, 'params'), validate(backToWaitingSchema), TicketController.backToWaiting);
router.patch("/:id/skip", authMiddleware, staffOnly, counterStaff, validate(ticketIdParamSchema, 'params'), validate(skipTicketSchema), TicketController.skip);

module.exports = router;
