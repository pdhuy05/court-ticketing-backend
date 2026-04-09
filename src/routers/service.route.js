const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

const { createServiceSchema, updateServiceSchema, addCountersSchema } = require('../validations/service.validation');

const ServiceController = require("../controllers/service.controller");

// ====================================
// PUBLIC ROUTES
// ====================================
router.get("/", ServiceController.getAllService);
router.get("/active", ServiceController.getActiveService);
router.get("/:id", ServiceController.getServiceById);


// ====================================
// ADMIN ROUTES
// ====================================
router.post("/", authMiddleware, adminOnly, validate(createServiceSchema), ServiceController.createService);
router.put("/:id", authMiddleware, adminOnly, validate(updateServiceSchema), ServiceController.updateService);
router.delete("/:id", authMiddleware, adminOnly, ServiceController.deleteService);

router.get("/:id/counters", authMiddleware, adminOnly, ServiceController.getCountersByService);
router.post("/:id/counters", authMiddleware, adminOnly, validate(addCountersSchema), ServiceController.addCounters);
router.delete("/:id/counters/:counterId", authMiddleware, adminOnly, ServiceController.removeCounter);

// ====================================
// THỐNG KÊ
// ====================================
router.get("/:id/stats",  authMiddleware, adminOnly, ServiceController.getStats);

module.exports = router;