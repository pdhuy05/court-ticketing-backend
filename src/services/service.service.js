const Service = require('../models/service.model');

exports.getAll = async () => {
  return Service.find().sort({ displayOrder: 1 });
};

exports.getActive = async () => {
  return Service.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .select("code name description displayOrder");
};

exports.create = async (data) => {
  const { code } = data;

  const existing = await Service.findOne({ code });

  if (existing) {
    const error = new Error('Mã dịch vụ đã tồn tại');
    error.statusCode = 400;
    throw error;
  }

  return Service.create({
    ...data,
    code: code.toUpperCase()
  });
};

exports.update = async (id, body) => {
  const service = await Service.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  });

  if (!service) {
    const error = new Error("Không tìm thấy dịch vụ");
    error.statusCode = 404;
    throw error;
  }

  return service;
};

exports.remove = async (id) => {
  const service = await Service.findByIdAndDelete(id);

  if (!service) {
    const error = new Error("Không tìm thấy dịch vụ");
    error.statusCode = 404;
    throw error;
  }

  return service;
};