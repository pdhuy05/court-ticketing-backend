const express = require("express");
const router = express.Router();

const validate = require('../middlewares/validate.middleware');
const {createTicketSchema, callNextSchema, idParamSchema, serviceCodeParamSchema } = require('../validations/ticket.validation');

const TicketController = require("../controllers/ticket.controller");

router.post( "/", validate(createTicketSchema), TicketController.create );

router.get('/waiting/:serviceId', validate(serviceCodeParamSchema, 'params'), TicketController.getWaitingByService );

router.post( '/call-next', validate(callNextSchema), TicketController.callNext );

router.patch( '/:id/complete', validate(idParamSchema, 'params'), TicketController.complete );

module.exports = router;