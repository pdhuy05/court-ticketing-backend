const ticketService = require('../services/ticket.service');
const printerService = require('../services/printer.service');
const settingService = require('../services/setting.service');
const { speakCallTicket } = require('../services/tts.service');
const Printer = require('../models/printer.model');
const Counter = require('../models/counter.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/Logger');
const { emitAdminNotificationSafe } = require('../services/admin-notification.service');

const ensureAssignedCounterId = (req) => {
    const counterId = req.user?.counterId;

    if (!counterId) {
        throw new ApiError(400, 'Tài khoản chưa được gán quầy');
    }

    return counterId;
};

const speakTicketIfTtsEnabled = async (displayNumber, counterName) => {
    if (!(await settingService.isTtsEnabled())) {
        return;
    }

    speakCallTicket(displayNumber, counterName).catch((error) => {
        logger.error(`Lỗi phát âm thanh: ${error.message}`);
    });
};

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

exports.create = asyncHandler(async (req, res) => {
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

    const availableCountersData = result.availableCounters.map((counter) => ({
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
});

exports.getAllWaiting = asyncHandler(async (req, res) => {
    const { tickets, lastIssuedByCounter } = await ticketService.getWaitingRoomData();

    res.json({
        success: true,
        count: tickets.length,
        data: tickets,
        lastIssuedByCounter
    });
});

exports.getTicketByQR = asyncHandler(async (req, res) => {
    const data = await ticketService.getTicketByQR(req.params.qrData);

    res.json({
        success: true,
        data
    });
});

exports.callNext = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);

    if (req.body.counterId && String(counterId) !== String(req.body.counterId)) {
        throw new ApiError(403, 'Bạn chỉ được phép gọi số cho quầy được gán');
    }

    const { nextTicket, counter } = await ticketService.callNext(
        counterId,
        req.user?._id
    );

    logger.success(`Đã gọi số ${nextTicket.formattedNumber} đến ${counter.name}`);
    await speakTicketIfTtsEnabled(nextTicket.displayNumber, counter.name);

    res.json({
        success: true,
        data: nextTicket,
        message: `Xin mời ông bà có số vé ${nextTicket.formattedNumber} đến ${counter.name}`
    });
});

exports.callById = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);

    const { ticket, counter } = await ticketService.callById(
        req.body.ticketId,
        counterId,
        req.user?._id
    );

    logger.success(`Đã gọi số ${ticket.formattedNumber} đến ${counter.name} theo ticketId`);
    await speakTicketIfTtsEnabled(ticket.displayNumber, counter.name);

    res.json({
        success: true,
        data: ticket,
        message: `Xin mời ông bà có số vé ${ticket.formattedNumber} đến ${counter.name}`
    });
});

exports.complete = asyncHandler(async (req, res) => {
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
});

exports.skip = asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const { id } = req.params;
    const counterId = req.user?.counterId;

    const ticket = await ticketService.skipTicket(id, reason, counterId, req.user?._id);

    logger.warning(`Đã bỏ qua số ${ticket.formattedNumber} - Lý do: ${reason || 'Khách vắng mặt '}`);

    const message = ticket.isRecall
        ? `Đã chuyển số ${ticket.formattedNumber} vào danh sách cần gọi lại`
        : `Đã đóng ticket ${ticket.formattedNumber} sau ${ticket.skipCount} lần bỏ qua`;

    res.json({
        success: true,
        data: ticket,
        message
    });
});

exports.getRecallList = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);
    const recallList = await ticketService.getRecallList(counterId, req.user?._id);

    res.json({
        success: true,
        count: recallList.length,
        data: recallList
    });
});

exports.recallTicket = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);
    const ticket = await ticketService.recallTicket(req.params.id, counterId, req.user?._id);
    const counter = await Counter.findById(counterId).select('name');

    await speakTicketIfTtsEnabled(ticket.displayNumber, counter?.name || 'quầy hiện tại');

    res.json({
        success: true,
        data: ticket,
        message: `Đã gọi lại số ${ticket.formattedNumber}`
    });
});

exports.recallProcessingTicket = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);
    const ticket = await ticketService.recallProcessingTicket(
        req.params.id,
        counterId,
        req.user?._id
    );
    const counter = await Counter.findById(counterId).select('name');

    logger.success(`Đã gọi lại vé đang xử lý ${ticket.formattedNumber}`);
    await speakTicketIfTtsEnabled(ticket.displayNumber, counter?.name || 'quầy hiện tại');

    res.json({
        success: true,
        data: ticket,
        message: `Đã gọi lại vé đang xử lý ${ticket.formattedNumber}`
    });
});

exports.cancelRecallTicket = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);
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
});

exports.getCounterDisplay = asyncHandler(async (req, res) => {
    const { counterId } = req.params;
    const data = await ticketService.getCounterDisplay(counterId);

    res.json({
        success: true,
        data
    });
});

exports.getMyCounter = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);
    const data = await ticketService.getMyCounter(counterId, req.user?._id);

    res.json({
        success: true,
        data: {
            ...data,
            staffName: req.user.fullName,
            staffId: req.user._id
        }
    });
});

exports.getStaffDisplay = asyncHandler(async (req, res) => {
    const counterId = ensureAssignedCounterId(req);
    const data = await ticketService.getStaffDisplay(counterId, req.user?._id);

    res.json({
        success: true,
        data: {
            ...data,
            staffName: req.user.fullName,
            staffId: req.user._id
        }
    });
});
