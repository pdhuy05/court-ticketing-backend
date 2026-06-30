const CounterService = require("../services/counter.service");
const asyncHandler = require("../utils/asyncHandler");
const { log, AUDIT_ACTIONS } = require("../services/audit.service");

exports.getAll = async (req, res) => {
  const counters = await CounterService.getAll();
  res.json({
    success: true,
    data: counters,
  });
};

exports.getById = async (req, res) => {
  const counter = await CounterService.getById(req.params.id);
  res.json({
    success: true,
    data: counter,
  });
};

exports.getActive = async (req, res) => {
  const counters = await CounterService.getActive();
  res.json({
    success: true,
    count: counters.length,
    data: counters,
  });
};

exports.create = async (req, res) => {
  const counter = await CounterService.create(req.body);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_CREATE,
    status: "success",
    targetId: String(counter._id),
    targetType: "counter",
    detail: { name: counter.name, code: counter.code },
  });

  res.status(201).json({
    success: true,
    data: counter,
    message: `Tạo ${counter.name} (${counter.code}) thành công với ${counter.services?.length || 0} quầy`,
  });
};

exports.update = async (req, res) => {
  const counter = await CounterService.update(req.params.id, req.body);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_UPDATE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "counter",
    detail: { name: counter.name, code: counter.code, changes: req.body },
  });

  res.json({
    success: true,
    data: counter,
    message: "Cập nhật phòng thành công",
  });
};

exports.addServices = async (req, res) => {
  const { serviceIds } = req.body;
  const counter = await CounterService.addServices(req.params.id, serviceIds);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_SERVICE_ADD,
    status: "success",
    targetId: String(req.params.id),
    targetType: "counter",
    detail: { serviceIds, addedCount: counter.addedCount },
  });

  res.json({
    success: true,
    data: counter,
    message: `Thêm ${counter.addedCount || 0} quầy vào phòng thành công`,
  });
};

exports.removeService = async (req, res) => {
  const { serviceId } = req.params;
  const counter = await CounterService.removeService(req.params.id, serviceId);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_SERVICE_REMOVE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "counter",
    detail: { serviceId },
  });

  res.json({
    success: true,
    data: counter,
    message: "Xóa quầy khỏi phòng thành công",
  });
};

exports.delete = async (req, res) => {
  const counter = await CounterService.delete(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_DELETE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "counter",
    detail: { name: counter?.name, code: counter?.code },
  });

  res.json({
    success: true,
    message: `Xóa phòng ${counter.name} và các quan hệ liên quan thành công`,
  });
};

exports.toggleActive = async (req, res) => {
  const counter = await CounterService.toggleActive(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_TOGGLE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "counter",
    detail: { name: counter.name, isActive: counter.isActive },
  });

  res.json({
    success: true,
    data: counter,
    message: `${counter.isActive ? "Kích hoạt" : "Vô hiệu hóa"} phòng ${counter.name} thành công`,
  });
};

exports.toggleTts = async (req, res) => {
  const counter = await CounterService.toggleTts(req.params.id);

  await log({
    req,
    action: AUDIT_ACTIONS.COUNTER_TTS_TOGGLE,
    status: "success",
    targetId: String(req.params.id),
    targetType: "counter",
    detail: { name: counter.name, ttsEnabled: counter.ttsEnabled },
  });

  res.json({
    success: true,
    data: counter,
    message: `${counter.ttsEnabled ? "Bật" : "Tắt"} loa TTS cho phòng ${counter.name} thành công`,
  });
};

exports.getServices = async (req, res) => {
  const result = await CounterService.getServices(req.params.id);
  res.json({
    success: true,
    data: result,
  });
};

exports.getAllStats = async (req, res) => {
  const stats = await CounterService.getAllStats();
  res.json({
    success: true,
    data: stats,
    count: stats.length,
  });
};

Object.keys(module.exports).forEach((key) => {
  module.exports[key] = asyncHandler(module.exports[key]);
});