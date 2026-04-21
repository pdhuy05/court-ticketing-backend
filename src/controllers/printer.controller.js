const Printer = require('../models/printer.model');
const printerService = require('../services/printer.service');
const Ticket = require('../models/ticket.model');
const asyncHandler = require('../utils/asyncHandler');

exports.getAll = async (req, res, next) => {
  const printers = await Printer.find().sort({ createdAt: -1 });
  res.json({ 
    success: true, 
    data: printers,
    count: printers.length 
  });
};

exports.getById = async (req, res, next) => {
  const printer = await Printer.findById(req.params.id);
  if (!printer) {
    return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy máy in' 
    });
  }
  res.json({ success: true, data: printer });
};

exports.create = async (req, res, next) => {
  const { name, code, type, connection, location, isActive, isDefault } = req.body;
  
  const existingPrinter = await Printer.findOne({ code });
  if (existingPrinter) {
    return res.status(400).json({ 
      success: false, 
      message: `Mã máy in '${code}' đã tồn tại` 
    });
  }
  
  const printer = await Printer.create({
    name, code, type, connection, location, isActive, isDefault
  });
  
  if (isActive && type === 'network' && connection?.host) {
    printerService.addNetworkPrinter(code, connection.host, connection.port || 9100);
  }
  
  res.status(201).json({ 
    success: true, 
    message: 'Tạo máy in thành công',
    data: printer 
  });
};

exports.update = async (req, res, next) => {
  const printer = await Printer.findByIdAndUpdate(
    req.params.id,
    req.body,
    { returnDocument: 'after', runValidators: true }
  );
  
  if (!printer) {
    return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy máy in' 
    });
  }
  
  res.json({ 
    success: true, 
    message: 'Cập nhật máy in thành công',
    data: printer 
  });
};

exports.delete = async (req, res, next) => {
  const printer = await Printer.findByIdAndDelete(req.params.id);
  if (!printer) {
    return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy máy in' 
    });
  }
  res.json({ success: true, message: 'Xóa máy in thành công' });
};

exports.testPrint = async (req, res, next) => {
  const { code } = req.params;
  
  const printer = await Printer.findOne({ code });
  if (!printer) {
    return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy máy in' 
    });
  }
  
  if (printer.type !== 'network') {
    return res.status(400).json({ 
      success: false, 
      message: 'Chỉ hỗ trợ test máy in network' 
    });
  }
  
  if (!printerService.hasPrinter(code)) {
    printerService.addNetworkPrinter(code, printer.connection.host, printer.connection.port || 9100);
  }
  
  const result = await printerService.testPrint(code);
  
  await Printer.findOneAndUpdate(
    { code },
    { lastTestAt: new Date(), lastTestStatus: result.success ? 'success' : 'failed' }
  );
  
  res.json(result);
};

exports.printTicket = async (req, res, next) => {
  const { printerCode, ticketId } = req.body;
  
  if (!printerCode || !ticketId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Thiếu thông tin printerCode hoặc ticketId' 
    });
  }
  
  const ticket = await Ticket.findById(ticketId).populate('serviceId');
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy ticket' });
  }
  
  const printer = await Printer.findOne({ code: printerCode });
  if (!printer) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy máy in' });
  }
  
  if (!printerService.hasPrinter(printerCode)) {
    printerService.addNetworkPrinter(printerCode, printer.connection.host, printer.connection.port || 9100);
  }
  
  const result = await printerService.printTicket(printerCode, ticket, ticket.serviceId);
  
  res.json({ success: true, message: 'Đã gửi lệnh in', data: result });
};

exports.getStatus = async (req, res, next) => {
  const { code } = req.params;
  
  const printer = await Printer.findOne({ code });
  if (!printer) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy máy in' });
  }
  
  res.json({
    success: true,
    data: {
      code: printer.code,
      name: printer.name,
      type: printer.type,
      isActive: printer.isActive,
      isConfigured: printerService.hasPrinter(code),
      lastTestAt: printer.lastTestAt,
      lastTestStatus: printer.lastTestStatus,
      connection: printer.connection
    }
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});
