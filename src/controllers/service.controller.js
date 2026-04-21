const Service = require('../services/service.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllService = async (req, res, next) => {
  const services = await Service.getAll();
  res.json({
    success: true,
    data: services
  });
};

exports.getActiveService = async (req, res, next) => {
  const services = await Service.getActive();
  res.json({
    success: true,
    count: services.length,
    data: services
  });
};

exports.getServiceById = async (req, res, next) => {
  const service = await Service.getById(req.params.id);
  res.json({
    success: true,
    data: service
  });
};

exports.createService = async (req, res, next) => {
  const service = await Service.create(req.body);
  res.status(201).json({
    success: true,
    data: service,
    message: 'Tạo dịch vụ thành công'
  });
};

exports.updateService = async (req, res, next) => {
  const service = await Service.update(req.params.id, req.body);
  res.json({
    success: true,
    data: service,
    message: 'Cập nhật dịch vụ thành công'
  });
};

exports.deleteService = async (req, res, next) => {
  const service = await Service.remove(req.params.id);
  res.json({
    success: true,
    message: 'Xóa thành công',
    data: service
  });
};

exports.addCounters = async (req, res, next) => {
  const { counterIds } = req.body;
  const result = await Service.addCounters(req.params.id, counterIds);

  res.json({
    success: true,
    data: result,
    message: `Thêm ${result.addedCounters} quầy vào dịch vụ thành công`
  });
};

exports.removeCounter = async (req, res, next) => {
  const { counterId } = req.params;
  const result = await Service.removeCounter(req.params.id, counterId);

  res.json({
    success: true,
    data: result,
    message: 'Xóa quầy khỏi dịch vụ thành công'
  });
};

exports.getCountersByService = async (req, res, next) => {
  const result = await Service.getCounters(req.params.id);

  res.json({
    success: true,
    data: result
  });
};

exports.getStats = async (req, res, next) => {
  const stats = await Service.getStats(req.params.id);
  res.json({
    success: true,
    data: stats
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});
