const express = require("express");
const router = express.Router();
const validate = require('../middlewares/validate.middleware');
const { authMiddleware, staffOnly } = require('../middlewares/auth.middleware');
const { createTicketSchema, callNextSchema } = require('../validations/ticket.validation');
const TicketController = require("../controllers/ticket.controller");

// ====================================
// PUBLIC ROUTES 
// ====================================
router.get("/waiting", TicketController.getAllWaiting);
router.post("/", validate(createTicketSchema), TicketController.create);
router.get("/counters/:counterId/display", TicketController.getCounterDisplay);

// ====================================
// STAFF ROUTES 
// ====================================
router.use(authMiddleware, staffOnly);

router.post("/call-next", validate(callNextSchema), TicketController.callNext);
router.patch("/:id/complete", TicketController.complete);
router.patch("/:id/skip", TicketController.skip);

module.exports = router;