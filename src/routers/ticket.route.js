const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, staffOnly, counterStaff } = require('../middlewares/auth.middleware');
const {
  counterDisplayParamsSchema,
  ticketIdParamSchema,
  createTicketSchema,
  callNextSchema,
  skipTicketSchema
} = require('../validations/ticket.validation');
const TicketController = require("../controllers/ticket.controller");

// ====================================
// PUBLIC ROUTES 
// ====================================
router.get("/waiting", TicketController.getAllWaiting);
router.get("/counters/:counterId/display", validate(counterDisplayParamsSchema, 'params'), TicketController.getCounterDisplay);
router.post("/", validate(createTicketSchema), TicketController.create);

// ====================================
// STAFF ROUTES 
// ====================================
router.get("/my-counter", authMiddleware, staffOnly, counterStaff, TicketController.getMyCounter);
router.get("/staff/display", authMiddleware, staffOnly, counterStaff, TicketController.getStaffDisplay);
router.post("/call-next", authMiddleware, staffOnly, counterStaff, validate(callNextSchema), TicketController.callNext);
router.patch("/:id/complete", authMiddleware, staffOnly, counterStaff, validate(ticketIdParamSchema, 'params'), TicketController.complete);
router.patch("/:id/skip", authMiddleware, staffOnly, counterStaff, validate(ticketIdParamSchema, 'params'), validate(skipTicketSchema), TicketController.skip);

module.exports = router;
