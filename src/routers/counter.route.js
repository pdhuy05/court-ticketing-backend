const express = require("express");
const router = express.Router();
const CounterController = require("../controllers/counter.controller");

router.get("/", CounterController.getAll);

router.post("/", CounterController.create);
router.put("/:id", CounterController.update);
router.delete("/:id", CounterController.delete);
router.patch('/:id/toggle', CounterController.toggleActive);

router.patch('/:id/add-service', CounterController.addService);  
router.patch('/:id/remove-service/:serviceId', CounterController.removeService);

module.exports = router;