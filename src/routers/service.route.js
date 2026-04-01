const express = require("express");
const router = express.Router();
const validate = require('../middlewares/validate.middleware');
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

// CRUD cơ bản
router.post("/", validate(createServiceSchema), ServiceController.createService);  
router.put("/:id", validate(updateServiceSchema), ServiceController.updateService);  
router.delete("/:id", ServiceController.deleteService);

router.get("/:id/counters", ServiceController.getCountersByService);
router.post("/:id/counters", validate(addCountersSchema), ServiceController.addCounters);
router.delete("/:id/counters/:counterId", ServiceController.removeCounter);

module.exports = router;