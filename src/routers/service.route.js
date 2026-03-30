const express = require("express");
const router = express.Router();
const validate = require('../middlewares/validate.middleware');
const { createServiceSchema, updateServiceSchema } = require('../validations/service.validation');
const ServiceController = require("../controllers/service.controller");

router.get("/", ServiceController.getAllService);
router.get("/active", ServiceController.getActiveService);

/*
====================================
        ADMIN
====================================
*/
router.post("/", validate(createServiceSchema), ServiceController.createService);  
router.put("/:id", validate(updateServiceSchema), ServiceController.updateService);  
router.delete("/:id", ServiceController.deleteService);

module.exports = router;