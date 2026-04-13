const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

const {
  counterIdParamSchema,
  counterServiceParamsSchema,
  createCounterSchema,
  updateCounterSchema,
  addServicesSchema
} = require('../validations/counter.validation');

const CounterController = require("../controllers/counter.controller");

// ====================================
// PUBLIC ROUTES
// ====================================
router.get("/", CounterController.getAll);
router.get("/active", CounterController.getActive);
router.get("/stats", CounterController.getAllStats);
router.get("/:id", validate(counterIdParamSchema, 'params'), CounterController.getById);

// ====================================
// ADMIN ROUTES (CRUD)
// ====================================
router.post("/", authMiddleware, adminOnly, validate(createCounterSchema), CounterController.create);
router.put("/:id", authMiddleware, adminOnly, validate(counterIdParamSchema, 'params'), validate(updateCounterSchema), CounterController.update);
router.delete("/:id", authMiddleware, adminOnly, validate(counterIdParamSchema, 'params'), CounterController.delete);
router.patch("/:id/toggle-active", authMiddleware, adminOnly, validate(counterIdParamSchema, 'params'), CounterController.toggleActive);

// ====================================
// QUẢN LÝ SERVICE CỦA COUNTER
// ====================================
router.get("/:id/services", authMiddleware, adminOnly, validate(counterIdParamSchema, 'params'), CounterController.getServices);
router.post("/:id/services", authMiddleware, adminOnly, validate(counterIdParamSchema, 'params'), validate(addServicesSchema), CounterController.addServices);
router.delete("/:id/services/:serviceId", authMiddleware, adminOnly, validate(counterServiceParamsSchema, 'params'), CounterController.removeService);

module.exports = router;
