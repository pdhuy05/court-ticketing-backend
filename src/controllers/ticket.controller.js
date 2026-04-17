const ticketService = require('../services/ticket.service');
const printerService = require('../services/printer.service');
const { speakCallTicket } = require('../services/tts.service');
const Printer = require('../models/printer.model');
const Counter = require('../models/counter.model');
const logger = require('../utils/Logger');
const { emitAdminNotificationSafe } = require('../services/admin-notification.service');

const queueAutoPrintTicket = ({ ticket, service, ticketNumberDisplay }) => {
    setImmediate(async () => {
        try {
            const defaultPrinter = await Printer.findOne({
                isDefault: true,
                isActive: true
            });

            if (!defaultPrinter) {
                logger.warning('Không tìm thấy máy in mặc định');
                return;
            }

            if (
                defaultPrinter.type !== 'network' ||
                !defaultPrinter.connection?.host
            ) {
                logger.warning(`Máy in ${defaultPrinter.name} chưa hỗ trợ loại kết nối ${defaultPrinter.type}`);
                return;
            }

            if (!printerService.hasPrinter(defaultPrinter.code)) {
                printerService.addNetworkPrinter(
                    defaultPrinter.code,
                    defaultPrinter.connection.host,
                    defaultPrinter.connection.port || 9100
                );
            }

            await printerService.printTicket(
                defaultPrinter.code,
                ticket,
                service
            );

            logger.success(`Đã in ticket ${ticketNumberDisplay} trên máy ${defaultPrinter.name}`);
        } catch (printError) {
            logger.error(`Lỗi in ticket: ${printError.message}`);
            emitAdminNotificationSafe({
                type: 'printer-error',
                severity: 'warning',
                title: 'Lỗi in ticket',
                message: printError.message,
                source: 'ticket.controller.queueAutoPrintTicket',
                meta: {
                    printer: 'default',
                    serviceId: service?._id,
                    ticketId: ticket?._id
                }
            });
        }
    });
};

exports.create = async (req, res) => {
    const result = await ticketService.createTicket(req.body);
    result.ticket.displayNumber = result.ticketNumberDisplay;

    const shouldPrint = req.body.autoPrint !== false;

    const ticketData = {
        _id: result.ticket._id,
        number: result.ticket.number,
        ticketNumber: result.ticket.ticketNumber,
        formattedNumber: result.ticketNumberFormatted,
        displayNumber: result.ticketNumberDisplay,
        name: result.ticket.name,
        phone: result.ticket.phone,
        status: result.ticket.status,
        createdAt: result.ticket.createdAt,
        qrData: result.qrData
    };

    const serviceData = {
        _id: result.service._id,
        code: result.service.code,
        name: result.service.name
    };

    const availableCountersData = result.availableCounters.map(counter => ({
        _id: counter._id,
        code: counter.code,
        name: counter.name,
        number: counter.number
    }));

    if (shouldPrint) {
        queueAutoPrintTicket({
            ticket: result.ticket,
            service: result.service,
            ticketNumberDisplay: result.ticketNumberDisplay
        });
    }

    res.status(201).json({
        success: true,
        data: ticketData,
        service: serviceData,
        availableCounters: availableCountersData,
        printRequested: shouldPrint,
        printStatus: shouldPrint ? 'queued' : 'disabled',
        printMessage: shouldPrint
            ? 'Lệnh in đã được đưa vào xử lý nền'
            : 'Tắt tự động in cho request này',
        message: `Đã cấp số ${result.ticketNumberDisplay} cho dịch vụ ${result.service.name}`
    });
};

exports.getAllWaiting = async (req, res) => {
    const { tickets, lastIssuedByCounter } = await ticketService.getWaitingRoomData();

    res.json({
        success: true,
        count: tickets.length,
        data: tickets,
        lastIssuedByCounter
    });
};

exports.getTicketByQR = async (req, res) => {
    const data = await ticketService.getTicketByQR(req.params.qrData);

    res.json({
        success: true,
        data
    });
};

exports.callNext = async (req, res) => {
    try {
        if (req.user?.counterId && String(req.user.counterId) !== req.body.counterId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn chỉ được phép gọi số cho quầy được gán'
            });
        }

        const { nextTicket, counter } = await ticketService.callNext(
            req.body.counterId,
            req.user?._id
        );

        logger.success(`Đã gọi số ${nextTicket.formattedNumber} đến ${counter.name}`);
        speakCallTicket(nextTicket.displayNumber, counter.name).catch((error) => {
            logger.error(`Lỗi phát âm thanh: ${error.message}`);
        });

        res.json({
            success: true,
            data: nextTicket,
            message: `Vui lòng số ${nextTicket.formattedNumber} đến ${counter.name}`
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

exports.callById = async (req, res) => {
    const counterId = req.user?.counterId;

    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }

    const { ticket, counter } = await ticketService.callById(
        req.body.ticketId,
        counterId,
        req.user?._id
    );

    logger.success(`Đã gọi số ${ticket.formattedNumber} đến ${counter.name} theo ticketId`);
    speakCallTicket(ticket.displayNumber, counter.name).catch((error) => {
        logger.error(`Lỗi phát âm thanh: ${error.message}`);
    });

    res.json({
        success: true,
        data: ticket,
        message: `Vui lòng số ${ticket.formattedNumber} đến ${counter.name}`
    });
};

exports.complete = async (req, res) => {
    const ticket = await ticketService.completeTicket(
        req.params.id,
        req.user?.counterId,
        req.user?._id
    );

    res.json({
        success: true,
        data: ticket,
        message: `Hoàn thành số ${ticket.formattedNumber}`
    });
};

exports.skip = async (req, res) => {
    const { reason } = req.body || {};
    const { id } = req.params;
    const counterId = req.user?.counterId;

    const ticket = await ticketService.skipTicket(id, reason, counterId, req.user?._id);

    logger.warning(`Đã bỏ qua số ${ticket.formattedNumber} - Lý do: ${reason || 'Khách vắng mặt '}`);

    res.json({
        success: true,
        data: ticket,
        message: `Đã chuyển số ${ticket.formattedNumber} vào danh sách cần gọi lại`
    });
};

exports.getRecallList = async (req, res) => {
    const counterId = req.user.counterId;

    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }

    const recallList = await ticketService.getRecallList(counterId, req.user?._id);

    res.json({
        success: true,
        count: recallList.length,
        data: recallList
    });
};

exports.recallTicket = async (req, res) => {
    const counterId = req.user.counterId;

    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }

    const ticket = await ticketService.recallTicket(req.params.id, counterId, req.user?._id);
    const counter = await Counter.findById(counterId).select('name');

    speakCallTicket(ticket.displayNumber, counter?.name || 'quầy hiện tại').catch((error) => {
        logger.error(`Lỗi phát âm thanh: ${error.message}`);
    });

    res.json({
        success: true,
        data: ticket,
        message: `Đã gọi lại số ${ticket.formattedNumber}`
    });
};

exports.recallProcessingTicket = async (req, res) => {
    const counterId = req.user.counterId;

    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }

    const ticket = await ticketService.recallProcessingTicket(
        req.params.id,
        counterId,
        req.user?._id
    );
    const counter = await Counter.findById(counterId).select('name');

    logger.success(`Đã gọi lại vé đang xử lý ${ticket.formattedNumber}`);
    speakCallTicket(ticket.displayNumber, counter?.name || 'quầy hiện tại').catch((error) => {
        logger.error(`Lỗi phát âm thanh: ${error.message}`);
    });

    res.json({
        success: true,
        data: ticket,
        message: `Đã gọi lại vé đang xử lý ${ticket.formattedNumber}`
    });
};

exports.cancelRecallTicket = async (req, res) => {
    const counterId = req.user.counterId;

    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }

    const ticket = await ticketService.cancelRecallTicket(
        req.params.id,
        counterId,
        req.user?._id,
        req.body?.reason
    );

    res.json({
        success: true,
        data: ticket,
        message: `Đã hủy ticket recall số ${ticket.formattedNumber}`
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

exports.getMyCounter = async (req, res, next) => {
    const counterId = req.user.counterId;
    
    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }
    
    const data = await ticketService.getMyCounter(counterId, req.user?._id);
    
    res.json({
        success: true,
        data: {
            ...data,
            staffName: req.user.fullName,
            staffId: req.user._id
        }
    });
};

exports.getStaffDisplay = async (req, res, next) => {
    const counterId = req.user.counterId;
    
    if (!counterId) {
        return res.status(400).json({
            success: false,
            message: 'Tài khoản chưa được gán quầy'
        });
    }
    
    const data = await ticketService.getStaffDisplay(counterId, req.user?._id);
    
    res.json({
        success: true,
        data: {
            ...data,
            staffName: req.user.fullName,
            staffId: req.user._id
        }
    });
};
