const CounterService = require('../services/counter.service');

exports.getAll = async (req, res) => {
  const counters = await CounterService.getAll();
  res.json({
    success: true,
    data: counters
  });
};

exports.getById = async (req, res) => {
  const counter = await CounterService.getById(req.params.id);
  res.json({
    success: true,
    data: counter
  });
};

exports.getActive = async (req, res) => {
  const counters = await CounterService.getActive();
  res.json({
    success: true,
    count: counters.length,
    data: counters
  });
};

exports.create = async (req, res) => {
  const counter = await CounterService.create(req.body);
  res.status(201).json({
    success: true,
    data: counter,
    message: `Tạo quầy ${counter.name} (${counter.code}) thành công với ${counter.services?.length || 0} dịch vụ`
  });
};

exports.update = async (req, res) => {
  const counter = await CounterService.update(req.params.id, req.body);
  res.json({
    success: true,
    data: counter,
    message: 'Cập nhật quầy thành công'
  });
};

exports.addServices = async (req, res) => {
  const { serviceIds } = req.body;
  const counter = await CounterService.addServices(req.params.id, serviceIds);
  res.json({
    success: true,
    data: counter,
    message: `Thêm ${counter.addedCount || 0} dịch vụ vào quầy thành công`
  });
};

exports.removeService = async (req, res) => {
  const { serviceId } = req.params;
  const counter = await CounterService.removeService(req.params.id, serviceId);
  res.json({
    success: true,
    data: counter,
    message: 'Xóa dịch vụ khỏi quầy thành công'
  });
};

exports.delete = async (req, res) => {
  const counter = await CounterService.delete(req.params.id);
  res.json({
    success: true,
    message: `Xóa quầy ${counter.name} và các quan hệ liên quan thành công`
  });
};

exports.toggleActive = async (req, res) => {
  const counter = await CounterService.toggleActive(req.params.id);
  res.json({
    success: true,
    data: counter,
    message: `${counter.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} quầy ${counter.name} thành công`
  });
};

exports.getServices = async (req, res) => {
  const result = await CounterService.getServices(req.params.id);
  res.json({
    success: true,
    data: result
  });
};

exports.getStatistics = async (req, res) => {
  const statistics = await CounterService.getStatistics(req.params.id);
  res.json({
    success: true,
    data: statistics
  });
};

exports.updateProcessedCount = async (req, res) => {
  const { increment } = req.body;
  const counter = await CounterService.updateProcessedCount(req.params.id, increment || 1);
  res.json({
    success: true,
    data: counter,
    message: 'Cập nhật số lượng xử lý thành công'
  });
};

exports.updateCurrentTicket = async (req, res) => {
  const { ticketId } = req.body;
  const counter = await CounterService.updateCurrentTicket(req.params.id, ticketId);
  res.json({
    success: true,
    data: counter,
    message: 'Cập nhật ticket hiện tại thành công'
  });
};