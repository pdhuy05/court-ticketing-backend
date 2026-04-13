const Service = require('../models/service.model');
const ServiceCounter = require('../models/serviceCounter.model');
const Counter = require('../models/counter.model');
const Ticket = require('../models/ticket.model');
const { emitDashboardUpdateSafe } = require('./dashboard.service');

exports.getAll = async () => {
  const services = await Service.find().sort({ displayOrder: 1 });

  const servicesWithCounters = await Promise.all(
    services.map(async (service) => {
      const counterRelations = await ServiceCounter.find({
        serviceId: service._id,
        isActive: true
      }).populate('counterId', 'code name number');

      const serviceObj = service.toObject();
      serviceObj.counters = counterRelations.map(rel => rel.counterId);

      return serviceObj;
    })
  );

  return servicesWithCounters;
};

exports.getActive = async () => {
  const services = await Service.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .select("code name description displayOrder icon backgroundColor");

  const servicesWithCounters = [];

  for (const service of services) {
    const counterRelations = await ServiceCounter.find({
      serviceId: service._id,
      isActive: true
    }).populate('counterId', 'code name number');

    if (counterRelations.length > 0) {
      const serviceObj = service.toObject();
      serviceObj.counters = counterRelations.map(rel => rel.counterId);
      servicesWithCounters.push(serviceObj);
    }
  }

  return servicesWithCounters;
};

exports.getById = async (id) => {
  const service = await Service.findById(id);
  
  if (!service) {
    const error = new Error('Không tìm thấy dịch vụ');
    error.statusCode = 404;
    throw error;
  }
  
  const counterRelations = await ServiceCounter.find({
    serviceId: service._id,
    isActive: true
  }).populate('counterId', 'code name number');

  const serviceObj = service.toObject();
  serviceObj.counters = counterRelations.map(rel => rel.counterId);

  return serviceObj;
};

exports.create = async (data) => {
  const { code, name, displayOrder } = data;

  const existing = await Service.findOne({ code: code.toUpperCase() });

  if (existing) {
    const error = new Error('Mã dịch vụ đã tồn tại');
    error.statusCode = 400;
    throw error;
  }

  if (displayOrder !== undefined && displayOrder !== null) {
    const existingOrder = await Service.findOne({ displayOrder });
    if (existingOrder) {
      const error = new Error(`Thứ tự hiển thị ${displayOrder} đã được sử dụng`);
      error.statusCode = 400;
      throw error;
    }
  }

  const service = await Service.create({
    ...data,
    code: code.toUpperCase(),
    name: name.toUpperCase()
  });

  await emitDashboardUpdateSafe('service-created');

  return service;
};

exports.update = async (id, body) => {
  const { code, name, displayOrder, backgroundColor, ...updateData } = body;

  if (code) {
    updateData.code = code.toUpperCase();
  }

  if (name) {
    updateData.name = name.toUpperCase();
  }

  if (displayOrder !== undefined && displayOrder !== null) {
    const existingOrder = await Service.findOne({
      displayOrder,
      _id: { $ne: id }
    });
    if (existingOrder) {
      const error = new Error(`Thứ tự hiển thị ${displayOrder} đã được sử dụng bởi dịch vụ khác`);
      error.statusCode = 400;
      throw error;
    }
    updateData.displayOrder = displayOrder;
  }
  
  const service = await Service.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!service) {
    const error = new Error('Không tìm thấy dịch vụ');
    error.statusCode = 404;
    throw error;
  }

  await emitDashboardUpdateSafe('service-updated');

  return service;
};

exports.remove = async (id) => {
  const service = await Service.findById(id);
  
  if (!service) {
    const error = new Error("Không tìm thấy dịch vụ");
    error.statusCode = 404;
    throw error;
  }
  
  const counterRelations = await ServiceCounter.find({ serviceId: service._id });
  
  if (counterRelations.length > 0) {
    const error = new Error(`Không thể xóa dịch vụ vì đang được sử dụng bởi ${counterRelations.length} quầy. Vui lòng xóa quan hệ trước.`);
    error.statusCode = 400;
    throw error;
  }
  
  await service.deleteOne();

  await emitDashboardUpdateSafe('service-deleted');
  
  return service;
};

exports.addCounters = async (id, counterIds) => {
  const service = await Service.findById(id);
  
  if (!service) {
    const error = new Error("Không tìm thấy dịch vụ");
    error.statusCode = 404;
    throw error;
  }
  
  const addedCounters = [];
  
  for (const counterId of counterIds) {
    const counter = await Counter.findById(counterId);
    if (!counter) {
      continue;
    }
    
    const existing = await ServiceCounter.findOne({
      serviceId: service._id,
      counterId
    });
    
    if (!existing) {
      const relation = await ServiceCounter.create({
        serviceId: service._id,
        counterId,
        isActive: true
      });
      addedCounters.push(relation);
    }
  }
  
  const result = {
    service,
    addedCounters: addedCounters.length
  };

  await emitDashboardUpdateSafe('service-counters-added');

  return result;
};

exports.removeCounter = async (id, counterId) => {
  const service = await Service.findById(id);
  
  if (!service) {
    const error = new Error("Không tìm thấy dịch vụ");
    error.statusCode = 404;
    throw error;
  }
  
  const deleted = await ServiceCounter.findOneAndDelete({
    serviceId: service._id,
    counterId
  });
  
  if (!deleted) {
    const error = new Error("Không tìm thấy mối quan hệ giữa dịch vụ và quầy");
    error.statusCode = 404;
    throw error;
  }
  
  const result = {
    service,
    removed: true
  };

  await emitDashboardUpdateSafe('service-counter-removed');

  return result;
};

exports.getCounters = async (id) => {
  const service = await Service.findById(id);
  
  if (!service) {
    const error = new Error("Không tìm thấy dịch vụ");
    error.statusCode = 404;
    throw error;
  }
  
  const counterRelations = await ServiceCounter.find({ 
    serviceId: service._id, 
    isActive: true 
  }).populate('counterId', 'code name number isActive');
  
  return {
    service,
    counters: counterRelations.map(rel => rel.counterId)
  };
};

exports.getStats = async (id) => {
  const service = await Service.findById(id);
  if (!service) throw new Error('Không tìm thấy dịch vụ');

  const waiting = await Ticket.countDocuments({ serviceId: id, status: 'waiting' });
  const processing = await Ticket.countDocuments({ serviceId: id, status: 'processing' });
  const completed = await Ticket.countDocuments({ serviceId: id, status: 'completed' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await Ticket.countDocuments({ 
    serviceId: id, 
    createdAt: { $gte: today } 
  });

  return {
    service: service.name,
    waiting,
    processing,
    completed,
    today: todayCount
  };
};
