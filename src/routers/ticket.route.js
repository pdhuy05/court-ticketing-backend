const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, staffOnly, counterStaff } = require('../middlewares/auth.middleware');
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
router.get("/my-counter", authMiddleware, staffOnly, counterStaff, TicketController.getMyCounter);

router.get("/staff/display", authMiddleware, staffOnly, counterStaff, TicketController.getStaffDisplay);

router.post("/call-next", authMiddleware, staffOnly, validate(callNextSchema), TicketController.callNext);

router.patch("/:id/complete", authMiddleware, staffOnly, TicketController.complete);

router.patch("/:id/skip", authMiddleware, staffOnly, TicketController.skip);    

module.exports = router;