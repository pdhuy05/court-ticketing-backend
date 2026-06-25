const Service = require("../services/service.service");
const asyncHandler = require("../utils/asyncHandler");
const { log, AUDIT_ACTIONS } = require("../services/audit.service");

exports.getAllService = async (req, res, next) => {
  const services = await Service.getAll();
  res.json({
    success: true,
    data: services,
  });
};

exports.getActiveService = async (req, res, next) => {
  const services = await Service.getActive();
  res.json({
    success: true,
    count: services.length,
    data: services,
  });
};

exports.getServiceById = async (req, res, next) => {
  const service = await Service.getById(req.params.id);
  res.json({
    success: true,
    data: service,
  });
};

exports.createService = async (req, res, next) => {
  const service = await Service.create(req.body);

  await log({
    req,
    action: AUDIT_ACTIONS.SERVICE_CREATE,
    status: "success",
    targetId: String(service._id),
    targetType: "service",
    detail: { name: service.name, code: service.code },
  });

  res.status(201).json({
    success: true,
    data: service,
    message: "Tạo quầy thành công",
  });
};

exports.updateService = async (req, res, next) => {
  const service = await Service.update(req.params.id, req.body);

  await log({
    req,
    action: AUDIT_ACTIONS.SERVICE_UPDATE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "service",
  });

  res.json({
    success: true,
    data: service,
    message: "Cập nhật quầy thành công",
  });
};

exports.deleteService = async (req, res, next) => {
  const service = await Service.remove(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.SERVICE_DELETE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "service",
  });

  res.json({
    success: true,
    message: "Xóa thành công",
    data: service,
  });
};

exports.addCounters = async (req, res, next) => {
  const { counterIds } = req.body;
  const result = await Service.addCounters(req.params.id, counterIds);

  res.json({
    success: true,
    data: result,
    message: `Thêm ${result.addedCounters} phòng vào quầy thành công`,
  });
};

exports.removeCounter = async (req, res, next) => {
  const { counterId } = req.params;
  const result = await Service.removeCounter(req.params.id, counterId);

  res.json({
    success: true,
    data: result,
    message: "Xóa phòng khỏi quầy thành công",
  });
};

exports.getCountersByService = async (req, res, next) => {
  const result = await Service.getCounters(req.params.id);

  res.json({
    success: true,
    data: result,
  });
};

exports.getStats = async (req, res, next) => {
  const stats = await Service.getStats(req.params.id);
  res.json({
    success: true,
    data: stats,
  });
};

exports.toggleDoublePrint = async (req, res, next) => {
  const { doublePrint } = req.body;
  const service = await Service.toggleDoublePrint(req.params.id, doublePrint);

  await log({
    req,
    action: AUDIT_ACTIONS.SERVICE_TOGGLE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "service",
    detail: { isActive: doublePrint },
  });

  res.json({
    success: true,
    data: service,
    message: `Đã ${doublePrint ? "bật" : "tắt"} in 2 vé cho dịch vụ "${service.name}"`,
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});