const ticketService = require('../services/ticket.service');
const printerService = require('../services/printer.service');
const Printer = require('../models/printer.model');
const logger = require('../utils/logger');

exports.create = async (req, res) => {
    const result = await ticketService.createTicket(req.body);

    let printResult = { success: false, message: 'Không có máy in để in' };
    const shouldPrint = req.body.autoPrint !== false;

    if (shouldPrint) {
        try {
            const defaultPrinter = await Printer.findOne({
                isDefault: true,
                isActive: true
            });

            if (defaultPrinter) {
                if (
                    defaultPrinter.type === 'network' &&
                    defaultPrinter.connection?.host
                ) {
                    if (!printerService.hasPrinter(defaultPrinter.code)) {
                        printerService.addNetworkPrinter(
                            defaultPrinter.code,
                            defaultPrinter.connection.host,
                            defaultPrinter.connection.port || 9100
                        );
                    }

                    printResult = await printerService.printTicket(
                        defaultPrinter.code,
                        result.ticket,
                        result.service
                    );

                    logger.success(`Đã in ticket ${result.ticketNumberDisplay} trên máy ${defaultPrinter.name}`);
                } else {
                    logger.warning(`Máy in ${defaultPrinter.name} chưa hỗ trợ loại kết nối ${defaultPrinter.type}`);

                    printResult = {
                        success: false,
                        message: `Máy in ${defaultPrinter.type} chưa được hỗ trợ`
                    };
                }
            } else {
                logger.warning(`Không tìm thấy máy in mặc định`);

                printResult = {
                    success: false,
                    message: 'Chưa cấu hình máy in mặc định'
                };
            }
        } catch (printError) {
            logger.error(`Lỗi in ticket: ${printError.message}`);

            printResult = {
                success: false,
                message: printError.message
            };
        }
    }

    res.status(201).json({
        success: true,
        data: {
            ...result.ticket.toObject(),
            formattedNumber: result.ticketNumberFormatted,
            availableCounters: result.availableCounters
        },
        service: result.service,
        printed: printResult.success,
        printMessage: printResult.message,
        message: `Đã cấp số ${result.ticketNumberDisplay} cho dịch vụ ${result.service.name}`
    });
};

exports.getAllWaiting = async (req, res) => {
    const tickets = await ticketService.getAllWaiting();

    res.json({
        success: true,
        count: tickets.length,
        data: tickets
    });
};

exports.callNext = async (req, res) => {
    try {
        const { nextTicket, counter } = await ticketService.callNext(
            req.body.counterId
        );

        logger.success(`Đã gọi số ${nextTicket.formattedNumber} đến ${counter.name}`);

        res.json({
            success: true,
            data: nextTicket,
            message: `Đã gọi số ${nextTicket.formattedNumber} đến ${counter.name}`
        });
    } catch (error) {
        if (error.message.includes('đang xử lý')) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            throw error;
        }
    }
};

exports.complete = async (req, res) => {
    const ticket = await ticketService.completeTicket(req.params.id);

    res.json({
        success: true,
        data: ticket,
        message: `Hoàn thành số ${ticket.formattedNumber}`
    });
};

exports.skip = async (req, res) => {
    const { reason } = req.body || {};

    const ticket = await ticketService.skipTicket(
        req.params.id,
        reason
    );

    logger.warning(`Đã bỏ qua số ${ticket.formattedNumber} - Lý do: ${reason || 'Khách vắng mặt '}`);

    res.json({
        success: true,
        data: ticket,
        message: `Đã bỏ qua số ${ticket.formattedNumber}`
    });
};

exports.getCounterDisplay = async (req, res) => {
    const { counterId } = req.params;

    const data = await ticketService.getCounterDisplay(counterId);

    res.json({
        success: true,
        data
    });
};