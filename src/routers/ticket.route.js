const express = require("express");
const router = express.Router();
const validate = require('../middlewares/validate.middleware');
const { createTicketSchema, callNextSchema, completeTicketSchema } = require('../validations/ticket.validation');
const TicketController = require("../controllers/ticket.controller");

// ====================================
// PUBLIC ROUTES
// ====================================

// ❌ Chưa có function -> comment lại
// router.get("/waiting", TicketController.getAllWaiting);

// Lấy danh sách ticket đang chờ theo service
router.get("/services/:serviceId/waiting", TicketController.getWaitingByService);

// Lấy ticket hiện tại của quầy
router.get("/counters/:counterId/current", TicketController.getCurrentTicket);

// Tạo ticket mới
router.post("/", validate(createTicketSchema), TicketController.create);

// ====================================
// ADMIN / STAFF ROUTES
// ====================================

// Gọi ticket tiếp theo cho quầy
router.post("/call-next", validate(callNextSchema), TicketController.callNext);

// Hoàn thành ticket
router.patch("/:id/complete", validate(completeTicketSchema), TicketController.complete);

// In lại ticket
router.post("/:id/reprint", TicketController.reprint);

// ❌ Chưa có function -> comment lại
// router.patch("/:id/cancel", TicketController.cancel);

// ❌ Chưa có function -> comment lại
// router.patch("/:id/skip", TicketController.skip);

// ====================================
// STATISTICS ROUTES
// ====================================

// router.get("/statistics/by-service", TicketController.getStatisticsByService);
// router.get("/statistics/daily", TicketController.getDailyStatistics);

module.exports = router;