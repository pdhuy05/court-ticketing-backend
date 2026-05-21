const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const AdminTicketController = require('../../controllers/admin/ticket.controller');
const { resetTicketsByDateSchema, searchTicketsSchema } = require('../../validations/admin-ticket.validation');

router.post('/reset-day', authMiddleware, adminOnly, validate(resetTicketsByDateSchema), AdminTicketController.resetTicketsByDate);
router.post('/reset-all', authMiddleware, adminOnly, AdminTicketController.resetAllTickets);

router.get('/search', authMiddleware, adminOnly, validate(searchTicketsSchema, 'query'), AdminTicketController.searchTickets);

module.exports = router;