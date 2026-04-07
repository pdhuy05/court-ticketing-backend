const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const { authMiddleware, adminOnly } = require('../middlewares/auth.middleware');

const { createCounterSchema, updateCounterSchema, addServicesSchema } = require('../validations/counter.validation');

const CounterController = require("../controllers/counter.controller");

// ====================================
// PUBLIC ROUTES
// ====================================
router.get("/", CounterController.getAll);
router.get("/active", CounterController.getActive);
router.get("/:id", CounterController.getById);

// ====================================
// ADMIN ROUTES (CRUD)
// ====================================
router.post("/", authMiddleware, adminOnly, validate(createCounterSchema), CounterController.create);
router.put("/:id", authMiddleware, adminOnly, validate(updateCounterSchema), CounterController.update);
router.delete("/:id", authMiddleware, adminOnly, CounterController.delete);
router.patch("/:id/toggle-active", authMiddleware, adminOnly, CounterController.toggleActive);

// ====================================
// QUẢN LÝ SERVICE CỦA COUNTER
// ====================================
router.get("/:id/services", authMiddleware, adminOnly, CounterController.getServices);
router.post("/:id/services", authMiddleware, adminOnly, validate(addServicesSchema), CounterController.addServices);
router.delete("/:id/services/:serviceId", authMiddleware, adminOnly, CounterController.removeService);

module.exports = router;