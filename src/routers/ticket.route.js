const express = require("express");
const router = express.Router();

const validate = require("../middlewares/validate.middleware");
const { authMiddleware, staffOnly, counterStaff, staffOnDuty } = require("../middlewares/auth.middleware");
const { ticketLimiter, staffApiLimiter } = require("../middlewares/rate-limit.middleware");

const {
  counterDisplayParamsSchema,
  cancelRecallTicketSchema,
  recallTicketParamsSchema,
  ticketIdParamSchema,
  createTicketSchema,
  callNextSchema,
  callByIdSchema,
  backToWaitingSchema,
  skipTicketSchema,
} = require("../validations/ticket.validation");

const TicketController = require("../controllers/ticket.controller");

const staffAuth = [authMiddleware, staffOnly, counterStaff];
const staffDuty = [...staffAuth, staffOnDuty];

// Public
router.get("/waiting", TicketController.getAllWaiting);
router.get("/qr/:qrData", TicketController.getTicketByQR);
router.get("/counters/:counterId/display", validate(counterDisplayParamsSchema, "params"), TicketController.getCounterDisplay);
router.post("/", ticketLimiter, validate(createTicketSchema), TicketController.create);
router.post("/:id/print", validate(ticketIdParamSchema, "params"), TicketController.printTicket);

// Staff
router.get("/my-counter", ...staffAuth, TicketController.getMyCounter);
router.get("/staff/display", ...staffAuth, TicketController.getStaffDisplay);
router.get("/recall-list", ...staffAuth, TicketController.getRecallList);

router.post("/call-next", ...staffDuty, staffApiLimiter, validate(callNextSchema), TicketController.callNext);
router.post("/call-by-id", ...staffDuty, staffApiLimiter, validate(callByIdSchema), TicketController.callById);
router.post("/:id/recall", ...staffDuty, staffApiLimiter, validate(recallTicketParamsSchema, "params"), TicketController.recallTicket);
router.post("/:id/recall-processing", ...staffDuty, staffApiLimiter, validate(recallTicketParamsSchema, "params"), TicketController.recallProcessingTicket);

router.patch("/:id/cancel-recall", ...staffDuty, staffApiLimiter, validate(recallTicketParamsSchema, "params"), validate(cancelRecallTicketSchema), TicketController.cancelRecallTicket);
router.patch("/:id/complete", ...staffDuty, staffApiLimiter, validate(ticketIdParamSchema, "params"), TicketController.complete);
router.patch("/:id/back", ...staffDuty, staffApiLimiter, validate(ticketIdParamSchema, "params"), validate(backToWaitingSchema), TicketController.backToWaiting);
router.patch("/:id/skip", ...staffDuty, staffApiLimiter, validate(ticketIdParamSchema, "params"), validate(skipTicketSchema), TicketController.skip);
router.patch("/:id/note", ...staffDuty, staffApiLimiter, validate(ticketIdParamSchema, "params"), TicketController.updateNote);

module.exports = router;