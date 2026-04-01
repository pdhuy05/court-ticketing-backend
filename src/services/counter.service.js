const Counter = require('../models/counter.model');
const ServiceCounter = require('../models/serviceCounter.model');
const Service = require('../models/service.model');

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
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
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
    const error = new Error('Mã quầy đã tồn tại');
    error.statusCode = 400;
    throw error;
  }
  
  const existingNumber = await Counter.findOne({ number });
  if (existingNumber) {
    const error = new Error(`Số quầy ${number} đã tồn tại`);
    error.statusCode = 400;
    throw error;
  }
  
  if (!serviceIds || serviceIds.length === 0) {
    const error = new Error('Phải chọn ít nhất một dịch vụ cho quầy');
    error.statusCode = 400;
    throw error;
  }
  
  const services = await Service.find({ _id: { $in: serviceIds } });
  if (services.length !== serviceIds.length) {
    const error = new Error('Một số dịch vụ không tồn tại');
    error.statusCode = 400;
    throw error;
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
      isActive: true,
      note: 'Gán từ lúc tạo quầy'
    });
    serviceRelations.push(relation);
  }
  
  const populatedServices = await ServiceCounter.find({ counterId: counter._id })
    .populate('serviceId', 'name code');
  
  const counterObj = counter.toObject();
  counterObj.services = populatedServices.map(rel => rel.serviceId);
  
  return counterObj;
};

exports.update = async (id, data) => {
  const { name, number, isActive, note } = data;
  
  const updateData = { name, number, isActive, note };
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
  
  if (Object.keys(updateData).length === 0) {
    const error = new Error('Không có dữ liệu để cập nhật');
    error.statusCode = 400;
    throw error;
  }
  
  if (number) {
    const existingNumber = await Counter.findOne({ number, _id: { $ne: id } });
    if (existingNumber) {
      const error = new Error(`Số quầy ${number} đã tồn tại`);
      error.statusCode = 400;
      throw error;
    }
  }
  
  const counter = await Counter.findByIdAndUpdate(
    id,
    updateData,
    { returnDocument: 'after', runValidators: true }
  );
  
  if (!counter) {
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
  }
  
  const serviceRelations = await ServiceCounter.find({ 
    counterId: counter._id, 
    isActive: true 
  }).populate('serviceId', 'name code');
  
  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map(rel => rel.serviceId);
  
  return counterObj;
};

exports.addServices = async (id, serviceIds) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
  }
  
  if (!serviceIds || serviceIds.length === 0) {
    const error = new Error('Vui lòng chọn ít nhất một dịch vụ');
    error.statusCode = 400;
    throw error;
  }
  
  const services = await Service.find({ _id: { $in: serviceIds } });
  if (services.length !== serviceIds.length) {
    const error = new Error('Một số dịch vụ không tồn tại');
    error.statusCode = 400;
    throw error;
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
        isActive: true,
        note: 'Thêm dịch vụ sau khi tạo quầy'
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
  
  return counterObj;
};

exports.removeService = async (id, serviceId) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
  }
  
  const deleted = await ServiceCounter.findOneAndDelete({
    serviceId,
    counterId: counter._id
  });
  
  if (!deleted) {
    const error = new Error('Không tìm thấy mối quan hệ giữa quầy và dịch vụ');
    error.statusCode = 404;
    throw error;
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
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
  }
  
  await ServiceCounter.deleteMany({ counterId: counter._id });
  
  await counter.deleteOne();
  
  return counter;
};

exports.toggleActive = async (id) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
  }
  
  counter.isActive = !counter.isActive;
  await counter.save();
  
  await ServiceCounter.updateMany(
    { counterId: counter._id },
    { isActive: counter.isActive }
  );
  
  return counter;
};

exports.getServices = async (id) => {
  const counter = await Counter.findById(id);
  
  if (!counter) {
    const error = new Error('Không tìm thấy quầy');
    error.statusCode = 404;
    throw error;
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