const ticketService = require('../services/ticket.service');
const printerService = require('../services/printer.service');
const Printer = require('../models/printer.model');

exports.create = async (req, res, next) => {
    // 1. Tạo ticket
    const result = await ticketService.createTicket(req.body);
    
    // 2. Tự động in ticket
    let printResult = { success: false, message: 'Không có máy in để in' };
    const shouldPrint = req.body.autoPrint !== false;
    
    if (shouldPrint) {
        try {
            const defaultPrinter = await Printer.findOne({ 
                isDefault: true, 
                isActive: true 
            });
            
            if (defaultPrinter) {
                // Kiểm tra loại máy in
                if (defaultPrinter.type === 'network' && defaultPrinter.connection?.host) {
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
                    
                    console.log(`✅ Đã in ticket ${result.ticketNumberDisplay} trên máy ${defaultPrinter.name}`);
                } else {
                    console.log(`⚠️ Máy in ${defaultPrinter.name} chưa hỗ trợ`);
                    printResult = { success: false, message: `Máy in ${defaultPrinter.type} chưa được hỗ trợ` };
                }
            } else {
                console.log('⚠️ Không tìm thấy máy in mặc định');
                printResult = { success: false, message: 'Chưa cấu hình máy in mặc định' };
            }
        } catch (printError) {
            console.error('❌ Lỗi in ticket:', printError.message);
            printResult = { success: false, message: printError.message };
        }
    }
    
    // 3. Trả về kết quả
    res.status(201).json({
        success: true,
        data: {
            ...result.ticket.toObject(),
            displayText: result.ticketNumberDisplay,  // ND001
            formattedNumber: result.ticketNumberFormatted,  // 001
            availableCounters: result.availableCounters
        },
        service: result.service,
        printed: printResult.success,
        printMessage: printResult.message,
        message: `Đã cấp số ${result.ticketNumberDisplay} cho dịch vụ ${result.service.name}`
    });
};

exports.getWaitingByService = async (req, res, next) => {
    const tickets = await ticketService.getWaitingByService(req.params.serviceId);
    res.json({
        success: true,
        count: tickets.length,
        data: tickets
    });
};

exports.callNext = async (req, res, next) => {
    const { nextTicket, counter } = await ticketService.callNext(req.body.counterId);
    res.json({
        success: true,
        data: nextTicket,
        message: `Đã gọi số ${nextTicket.displayText} đến ${counter.name}`
    });
};

exports.complete = async (req, res, next) => {
    const ticket = await ticketService.completeTicket(req.params.id);
    res.json({
        success: true,
        data: ticket,
        message: `Hoàn thành số ${ticket.displayText}`
    });
};

exports.getCurrentTicket = async (req, res, next) => {
    const ticket = await ticketService.getCurrentTicket(req.params.counterId);
    res.json({
        success: true,
        data: ticket,
        message: ticket ? undefined : 'Quầy đang rảnh'
    });
};

exports.reprint = async (req, res, next) => {
    const { id } = req.params;
    
    // Lấy ticket
    const ticket = await Ticket.findById(id).populate('serviceId');
    if (!ticket) {
        throw new ApiError(404, 'Không tìm thấy ticket');
    }
    
    // Tìm máy in mặc định
    const defaultPrinter = await Printer.findOne({ isDefault: true, isActive: true });
    if (!defaultPrinter) {
        throw new ApiError(400, 'Không có máy in mặc định');
    }
    
    // Thêm vào service nếu chưa có
    if (!printerService.hasPrinter(defaultPrinter.code)) {
        if (defaultPrinter.type === 'network' && defaultPrinter.connection?.host) {
            printerService.addNetworkPrinter(
                defaultPrinter.code,
                defaultPrinter.connection.host,
                defaultPrinter.connection.port || 9100
            );
        }
    }
    
    // In lại
    const result = await printerService.printTicket(
        defaultPrinter.code,
        ticket,
        ticket.serviceId
    );
    
    res.json({
        success: true,
        message: `Đã in lại ticket ${ticket.number.toString().padStart(3, '0')}`,
        printed: result.success
    });
};