const express = require("express");
const router = express.Router();
const validate = require('../middlewares/validate.middleware');
const { createCounterSchema, updateCounterSchema,addServicesSchema } = require('../validations/counter.validation');
const CounterController = require("../controllers/counter.controller");

// ====================================
// PUBLIC ROUTES
// ====================================
router.get("/", CounterController.getAll);
router.get("/active", CounterController.getActive);
router.get("/:id", CounterController.getById);

// ====================================
// ADMIN ROUTES
// ====================================

// CRUD 
router.post("/", validate(createCounterSchema), CounterController.create);
router.put("/:id", validate(updateCounterSchema), CounterController.update);
router.delete("/:id", CounterController.delete);
router.patch("/:id/toggle-active", CounterController.toggleActive);

router.get("/:id/services", CounterController.getServices);
router.post("/:id/services", validate(addServicesSchema), CounterController.addServices);
router.delete("/:id/services/:serviceId", CounterController.removeService);

module.exports = router;