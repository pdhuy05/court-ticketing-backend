const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

const {
  serviceIdParamSchema,
  serviceCounterParamsSchema,
  createServiceSchema,
  updateServiceSchema,
  addCountersSchema
} = require('../validations/service.validation');

const ServiceController = require("../controllers/service.controller");

// ====================================
// PUBLIC ROUTES
// ====================================
router.get("/", ServiceController.getAllService);
router.get("/active", ServiceController.getActiveService);
router.get("/:id", validate(serviceIdParamSchema, 'params'), ServiceController.getServiceById);


// ====================================
// ADMIN ROUTES
// ====================================
router.post("/", authMiddleware, adminOnly, validate(createServiceSchema), ServiceController.createService);
router.put("/:id", authMiddleware, adminOnly, validate(serviceIdParamSchema, 'params'), validate(updateServiceSchema), ServiceController.updateService);
router.delete("/:id", authMiddleware, adminOnly, validate(serviceIdParamSchema, 'params'), ServiceController.deleteService);

router.get("/:id/counters", authMiddleware, adminOnly, validate(serviceIdParamSchema, 'params'), ServiceController.getCountersByService);
router.post("/:id/counters", authMiddleware, adminOnly, validate(serviceIdParamSchema, 'params'), validate(addCountersSchema), ServiceController.addCounters);
router.delete("/:id/counters/:counterId", authMiddleware, adminOnly, validate(serviceCounterParamsSchema, 'params'), ServiceController.removeCounter);

// ====================================
// THỐNG KÊ
// ====================================
router.get("/:id/stats", authMiddleware, adminOnly, validate(serviceIdParamSchema, 'params'), ServiceController.getStats);

module.exports = router;
