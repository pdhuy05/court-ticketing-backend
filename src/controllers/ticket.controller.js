const ticketService = require('../services/ticket.service');

exports.create = async (req, res) => {
    try {
        const result = await ticketService.createTicket(req.body);

        res.status(201).json({
            success: true,
            data: result.ticket,
            message: `Đã cấp số ${result.ticket.ticketNumber} cho dịch vụ ${result.service.name}`
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getWaitingByService = async (req, res) => {
    try {
        const tickets = await ticketService.getWaitingByService(req.params.serviceId);

        res.json({
            success: true,
            count: tickets.length,
            data: tickets
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.callNext = async (req, res) => {
    try {
        const { nextTicket, counter } = await ticketService.callNext(req.body.counterId);

        res.json({
            success: true,
            data: nextTicket,
            message: `Đã gọi số ${nextTicket.ticketNumber} đến ${counter.name}`
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.complete = async (req, res) => {
    try {
        const ticket = await ticketService.completeTicket(req.params.id);

        res.json({
            success: true,
            data: ticket,
            message: `Hoàn thành số ${ticket.ticketNumber}`
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getCurrentTicket = async (req, res) => {
    try {
        const ticket = await ticketService.getCurrentTicket(req.params.counterId);

        res.json({
            success: true,
            data: ticket,
            message: ticket ? undefined : 'Quầy đang rảnh'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};