const express = require('express');
const router = express.Router();
const Printer = require('../models/printer.model');
const printerService = require('../services/printer.service');

// ==================== ROUTES CƠ BẢN ====================

// GET: Lấy danh sách tất cả máy in
router.get('/', async (req, res) => {
  try {
    const printers = await Printer.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: printers,
      count: printers.length 
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách máy in:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// GET: Lấy máy in theo ID
router.get('/:id', async (req, res) => {
  try {
    const printer = await Printer.findById(req.params.id);
    if (!printer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy máy in' 
      });
    }
    res.json({ success: true, data: printer });
  } catch (error) {
    console.error('Lỗi lấy máy in:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// POST: Tạo máy in mới
router.post('/', async (req, res) => {
  try {
    const { name, code, type, connection, location, isActive, isDefault } = req.body;
    
    // Kiểm tra code đã tồn tại chưa
    const existingPrinter = await Printer.findOne({ code });
    if (existingPrinter) {
      return res.status(400).json({ 
        success: false, 
        message: `Mã máy in '${code}' đã tồn tại` 
      });
    }
    
    // Tạo máy in mới
    const printer = await Printer.create({
      name,
      code,
      type,
      connection,
      location,
      isActive,
      isDefault
    });
    
    // Nếu máy in active, thêm vào service để sử dụng
    if (isActive && type === 'network' && connection?.host) {
      printerService.addNetworkPrinter(
        code,
        connection.host,
        connection.port || 9100
      );
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Tạo máy in thành công',
      data: printer 
    });
    
  } catch (error) {
    console.error('Lỗi tạo máy in:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// PUT: Cập nhật máy in
router.put('/:id', async (req, res) => {
  try {
    const printer = await Printer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
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
    
  } catch (error) {
    console.error('Lỗi cập nhật máy in:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// DELETE: Xóa máy in
router.delete('/:id', async (req, res) => {
  try {
    const printer = await Printer.findByIdAndDelete(req.params.id);
    
    if (!printer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy máy in' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Xóa máy in thành công' 
    });
    
  } catch (error) {
    console.error('Lỗi xóa máy in:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ==================== ROUTES CHỨC NĂNG ====================

// POST: Test kết nối máy in
router.post('/:code/test', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Tìm máy in trong database
    const printer = await Printer.findOne({ code });
    if (!printer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy máy in' 
      });
    }
    
    // Kiểm tra loại máy in
    if (printer.type !== 'network') {
      return res.status(400).json({ 
        success: false, 
        message: 'Chỉ hỗ trợ test máy in network' 
      });
    }
    
    // Thêm vào service nếu chưa có
    if (!printerService.hasPrinter(code)) {
      printerService.addNetworkPrinter(
        code,
        printer.connection.host,
        printer.connection.port || 9100
      );
    }
    
    // Test kết nối
    const result = await printerService.testPrint(code);
    
    // Cập nhật trạng thái test
    await Printer.findOneAndUpdate(
      { code },
      { 
        lastTestAt: new Date(),
        lastTestStatus: result.success ? 'success' : 'failed'
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Lỗi test máy in:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// POST: In ticket
router.post('/print', async (req, res) => {
  try {
    const { printerCode, ticketId } = req.body;
    
    if (!printerCode || !ticketId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin printerCode hoặc ticketId' 
      });
    }
    
    // Lấy thông tin ticket
    const Ticket = require('../models/ticket.model');
    const Service = require('../models/service.model');
    
    const ticket = await Ticket.findById(ticketId).populate('serviceId');
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy ticket' 
      });
    }
    
    // Lấy thông tin máy in
    const printer = await Printer.findOne({ code: printerCode });
    if (!printer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy máy in' 
      });
    }
    
    // Thêm vào service nếu chưa có
    if (!printerService.hasPrinter(printerCode)) {
      printerService.addNetworkPrinter(
        printerCode,
        printer.connection.host,
        printer.connection.port || 9100
      );
    }
    
    // In ticket
    const result = await printerService.printTicket(
      printerCode, 
      ticket, 
      ticket.serviceId
    );
    
    res.json({ 
      success: true, 
      message: 'Đã gửi lệnh in',
      data: result 
    });
    
  } catch (error) {
    console.error('Lỗi in ticket:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// GET: Lấy trạng thái máy in
router.get('/:code/status', async (req, res) => {
  try {
    const { code } = req.params;
    
    const printer = await Printer.findOne({ code });
    if (!printer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy máy in' 
      });
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
    
  } catch (error) {
    console.error('Lỗi lấy trạng thái:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
