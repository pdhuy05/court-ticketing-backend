const Counter = require('../models/counter.model');
const ServiceCounter = require('../models/serviceCounter.model');
const Service = require('../models/service.model');
const Ticket = require('../models/ticket.model');
const { TicketStatus } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const { emitDashboardUpdateSafe } = require('./dashboard.service');

exports.getAll = async () => {
  const counters = await Counter.find().sort({ code: 1 });
  
  const countersWithServices = await Promise.all(
    counters.map(async (counter) => {
      const serviceRelations = await ServiceCounter.find({ 
        counterId: counter._id, 
        isActive: true 
      }).populate('serviceId', 'code name icon displayOrder');
      
      const counterObj = counter.toObject();
      counterObj.services = serviceRelations.map(rel => rel.serviceId);
      
      return counterObj;
    })
  );
  
  return countersWithServices;
};

exports.getById = async (id) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  const serviceRelations = await ServiceCounter.find({ 
    counterId: counter._id, 
    isActive: true 
  }).populate('serviceId', 'code name icon displayOrder');
  
  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map(rel => rel.serviceId);

  return counterObj;
};

exports.getActive = async () => {
  const counters = await Counter.find({ isActive: true }).sort({ code: 1 });
  
  const countersWithServices = await Promise.all(
    counters.map(async (counter) => {
      const serviceRelations = await ServiceCounter.find({ 
        counterId: counter._id, 
        isActive: true 
      }).populate('serviceId', 'code name');
      
      const counterObj = counter.toObject();
      counterObj.services = serviceRelations.map(rel => rel.serviceId);
      
      return counterObj;
    })
  );
  
  return countersWithServices;
};

exports.create = async (data) => {
  const { name, code, number, serviceIds, note, isActive } = data;
  
  const existingCode = await Counter.findOne({ code: code.toUpperCase() });
  if (existingCode) {
    throw new ApiError(400, 'Mã quầy đã tồn tại');
  }
  
  const existingNumber = await Counter.findOne({ number });
  if (existingNumber) {
    throw new ApiError(400, `Số quầy ${number} đã tồn tại`);
  }
  
  if (!serviceIds || serviceIds.length === 0) {
    throw new ApiError(400, 'Phải chọn ít nhất một dịch vụ cho quầy');
  }
  
  const services = await Service.find({ _id: { $in: serviceIds } });
  if (services.length !== serviceIds.length) {
    throw new ApiError(400, 'Một số dịch vụ không tồn tại');
  }
  
  const counter = await Counter.create({
    name,
    code: code.toUpperCase(),
    number: number || 1,
    note: note || '',
    isActive: isActive !== undefined ? isActive : true
  });
  
  const serviceRelations = [];
  for (const serviceId of serviceIds) {
    const relation = await ServiceCounter.create({
      serviceId,
      counterId: counter._id,
      isActive: true
    });
    serviceRelations.push(relation);
  }
  
  const populatedServices = await ServiceCounter.find({ counterId: counter._id })
    .populate('serviceId', 'name code');
  
  const counterObj = counter.toObject();
  counterObj.services = populatedServices.map(rel => rel.serviceId);
  
  await emitDashboardUpdateSafe('counter-created');

  return counterObj;
};

exports.update = async (id, data) => {
  const { name, number, isActive, note } = data;
  
  const updateData = { name, number, isActive, note };
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
  
  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'Không có dữ liệu để cập nhật');
  }
  
  if (number) {
    const existingNumber = await Counter.findOne({ number, _id: { $ne: id } });
    if (existingNumber) {
      throw new ApiError(400, `Số quầy ${number} đã tồn tại`);
    }
  }
  
  const counter = await Counter.findByIdAndUpdate(
    id,
    updateData,
    { returnDocument: 'after', runValidators: true }
  );
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  const serviceRelations = await ServiceCounter.find({ 
    counterId: counter._id, 
    isActive: true 
  }).populate('serviceId', 'name code');
  
  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map(rel => rel.serviceId);
  
  await emitDashboardUpdateSafe('counter-updated');

  return counterObj;
};

exports.addServices = async (id, serviceIds) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  if (!serviceIds || serviceIds.length === 0) {
    throw new ApiError(400, 'Vui lòng chọn ít nhất một dịch vụ');
  }
  
  const services = await Service.find({ _id: { $in: serviceIds } });
  if (services.length !== serviceIds.length) {
    throw new ApiError(400, 'Một số dịch vụ không tồn tại');
  }
  
  const addedServices = [];
  for (const serviceId of serviceIds) {
    const existing = await ServiceCounter.findOne({
      serviceId,
      counterId: counter._id
    });
    
    if (!existing) {
      const relation = await ServiceCounter.create({
        serviceId,
        counterId: counter._id,
        isActive: true
      });
      addedServices.push(relation);
    }
  }
  
  const serviceRelations = await ServiceCounter.find({ 
    counterId: counter._id, 
    isActive: true 
  }).populate('serviceId', 'name code');
  
  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map(rel => rel.serviceId);
  counterObj.addedCount = addedServices.length;
  
  await emitDashboardUpdateSafe('counter-services-added');

  return counterObj;
};

exports.removeService = async (id, serviceId) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  const deleted = await ServiceCounter.findOneAndDelete({
    serviceId,
    counterId: counter._id
  });
  
  if (!deleted) {
    throw new ApiError(404, 'Không tìm thấy mối quan hệ giữa quầy và dịch vụ');
  }
  
  const serviceRelations = await ServiceCounter.find({ 
    counterId: counter._id, 
    isActive: true 
  }).populate('serviceId', 'name code');
  
  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map(rel => rel.serviceId);
  
  return counterObj;
};

exports.delete = async (id) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  await ServiceCounter.deleteMany({ counterId: counter._id });
  
  await counter.deleteOne();

  await emitDashboardUpdateSafe('counter-deleted');
  
  return counter;
};

exports.toggleActive = async (id) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  counter.isActive = !counter.isActive;
  await counter.save();
  
  await ServiceCounter.updateMany(
    { counterId: counter._id },
    { isActive: counter.isActive }
  );

  await emitDashboardUpdateSafe('counter-toggled');
  
  return counter;
};

exports.getServices = async (id) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    throw new ApiError(404, 'Không tìm thấy quầy');
  }
  
  const serviceRelations = await ServiceCounter.find({ 
    counterId: counter._id, 
    isActive: true 
  }).populate('serviceId', 'code name icon description');
  
  return {
    counter,
    services: serviceRelations.map(rel => rel.serviceId)
  };
};

exports.getAllStats = async () => {
  const counters = await Counter.find({ isActive: true }).sort({ number: 1 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await Promise.all(
    counters.map(async (counter) => {
      const [completedToday, processing] = await Promise.all([
        Ticket.countDocuments({
          counterId: counter._id,
          status: TicketStatus.COMPLETED,
          completedAt: { $gte: today }
        }),
        Ticket.countDocuments({
          counterId: counter._id,
          status: TicketStatus.PROCESSING
        })
      ]);

      return {
        counter: {
          id: counter._id,
          name: counter.name,
          number: counter.number
        },
        totalProcessed: counter.processedCount || 0,
        completedToday,
        processing
      };
    })
  );

  return stats.sort((a, b) => b.totalProcessed - a.totalProcessed);
};
