const Counter = require("../models/counter.model");
const ServiceCounter = require("../models/serviceCounter.model");
const Service = require("../models/service.model");
const Ticket = require("../models/ticket.model");
const { TicketStatus } = require("../constants/enums");
const ApiError = require("../utils/ApiError");
const { emitDashboardUpdateSafe } = require("./dashboard.service");

const normalizeServiceIds = (serviceIds) => [
  ...new Set((serviceIds || []).filter(Boolean).map(String)),
];

const assertCanRemoveServicesFromCounter = async (counterId, serviceIds) => {
  const normalizedServiceIds = normalizeServiceIds(serviceIds);

  if (normalizedServiceIds.length === 0) {
    return;
  }

  const [waitingCount, processingCount] = await Promise.all([
    Ticket.countDocuments({
      queueCounterId: counterId,
      serviceId: { $in: normalizedServiceIds },
      status: TicketStatus.WAITING,
    }),
    Ticket.countDocuments({
      counterId,
      serviceId: { $in: normalizedServiceIds },
      status: TicketStatus.PROCESSING,
    }),
  ]);

  if (waitingCount > 0 || processingCount > 0) {
    const pendingCount = waitingCount + processingCount;
    throw new ApiError(
      400,
      `Không thể xóa quầy ra khỏi phòng vì còn ${pendingCount} vé.`,
    );
  }
};

const attachServicesToCounters = async (counters, serviceFields) => {
  if (!counters.length) {
    return [];
  }

  const counterIds = counters.map((counter) => counter._id);
  const serviceRelations = await ServiceCounter.find({
    counterId: { $in: counterIds },
    isActive: true,
  }).populate("serviceId", serviceFields);

  const servicesByCounterId = new Map();

  serviceRelations.forEach((relation) => {
    const key = String(relation.counterId);
    if (!servicesByCounterId.has(key)) {
      servicesByCounterId.set(key, []);
    }

    servicesByCounterId.get(key).push(relation.serviceId);
  });

  return counters.map((counter) => {
    const counterObj = counter.toObject();
    counterObj.services = servicesByCounterId.get(String(counter._id)) || [];
    return counterObj;
  });
};

exports.getAll = async () => {
  const counters = await Counter.find().sort({ code: 1 });

  return attachServicesToCounters(counters, "code name icon displayOrder");
};

exports.getById = async (id) => {
  const counter = await Counter.findById(id);

  if (!counter) {
    throw new ApiError(404, "Không tìm thấy phòng");
  }

  const serviceRelations = await ServiceCounter.find({
    counterId: counter._id,
    isActive: true,
  }).populate("serviceId", "code name icon displayOrder");

  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map((rel) => rel.serviceId);

  return counterObj;
};

exports.getActive = async () => {
  const counters = await Counter.find({ isActive: true }).sort({ code: 1 });

  return attachServicesToCounters(counters, "code name");
};

exports.create = async (data) => {
  const { name, code, number, serviceIds, note, isActive } = data;
  const normalizedServiceIds = normalizeServiceIds(serviceIds);

  const existingCode = await Counter.findOne({ code: code.toUpperCase() });
  if (existingCode) {
    throw new ApiError(400, "Mã phòng đã tồn tại");
  }

  const existingNumber = await Counter.findOne({ number });
  if (existingNumber) {
    throw new ApiError(400, `Số phòng ${number} đã tồn tại`);
  }

  const services =
    normalizedServiceIds.length > 0
      ? await Service.find({ _id: { $in: normalizedServiceIds } })
      : [];

  if (services.length !== normalizedServiceIds.length) {
    throw new ApiError(400, "Một số quầy không tồn tại");
  }

  let counter = null;

  try {
    counter = await Counter.create({
      name,
      code: code.toUpperCase(),
      number: number || 1,
      note: note || "",
      isActive: isActive !== undefined ? isActive : true,
    });

    if (normalizedServiceIds.length > 0) {
      await ServiceCounter.insertMany(
        normalizedServiceIds.map((serviceId) => ({
          serviceId,
          counterId: counter._id,
          isActive: true,
        })),
      );
    }

    const populatedServices = await ServiceCounter.find({
      counterId: counter._id,
    }).populate("serviceId", "name code");

    const counterObj = counter.toObject();
    counterObj.services = populatedServices.map((rel) => rel.serviceId);

    await emitDashboardUpdateSafe("counter-created");

    return counterObj;
  } catch (error) {
    if (counter?._id) {
      await ServiceCounter.deleteMany({ counterId: counter._id });
      await Counter.deleteOne({ _id: counter._id });
    }

    throw error;
  }
};

exports.update = async (id, data) => {
  const { name, number, isActive, note, serviceIds } = data;

  const updateData = { name, number, isActive, note };
  Object.keys(updateData).forEach(
    (key) => updateData[key] === undefined && delete updateData[key],
  );

  if (number) {
    const existingNumber = await Counter.findOne({ number, _id: { $ne: id } });
    if (existingNumber) {
      throw new ApiError(400, `Số phòng ${number} đã tồn tại`);
    }
  }

  const counter = await Counter.findByIdAndUpdate(id, updateData, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!counter) {
    throw new ApiError(404, "Không tìm thấy phòng");
  }

  if (serviceIds !== undefined) {
    const normalizedServiceIds = normalizeServiceIds(serviceIds);
    if (normalizedServiceIds.length > 0) {
      const services = await Service.find({
        _id: { $in: normalizedServiceIds },
      });
      if (services.length !== normalizedServiceIds.length) {
        throw new ApiError(400, "Một số quầy không tồn tại");
      }
    }

    const currentRelations = await ServiceCounter.find({
      counterId: counter._id,
    }).select("serviceId");

    const removedServiceIds = currentRelations
      .map((relation) => String(relation.serviceId))
      .filter(
        (existingServiceId) =>
          !normalizedServiceIds.includes(existingServiceId),
      );

    await assertCanRemoveServicesFromCounter(counter._id, removedServiceIds);

    await ServiceCounter.insertMany(
      normalizedServiceIds.map(serviceId => ({
        serviceId,
        counterId: counter._id,
        isActive: true,
      }))
    );

    await ServiceCounter.deleteMany({
      counterId: counter._id,
      serviceId: { $nin: normalizedServiceIds },
    });
  }

  const serviceRelations = await ServiceCounter.find({
    counterId: counter._id,
    isActive: true,
  }).populate("serviceId", "name code");

  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map((rel) => rel.serviceId);

  await emitDashboardUpdateSafe("counter-updated");

  return counterObj;
};

exports.addServices = async (id, serviceIds) => {
  const counter = await Counter.findById(id);

  if (!counter) {
    throw new ApiError(404, "Không tìm thấy phòng");
  }

  if (!serviceIds || serviceIds.length === 0) {
    throw new ApiError(400, "Vui lòng chọn ít nhất một quầy");
  }

  const services = await Service.find({ _id: { $in: serviceIds } });
  if (services.length !== serviceIds.length) {
    throw new ApiError(400, "Một số quầy không tồn tại");
  }

  const addedServices = [];
  for (const serviceId of serviceIds) {
    const existing = await ServiceCounter.findOne({
      serviceId,
      counterId: counter._id,
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
        addedServices.push(existing);
      }
      continue;
    }

    const relation = await ServiceCounter.create({
      serviceId,
      counterId: counter._id,
      isActive: true,
    });
    addedServices.push(relation);
  }

  const serviceRelations = await ServiceCounter.find({
    counterId: counter._id,
    isActive: true,
  }).populate("serviceId", "name code");

  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map((rel) => rel.serviceId);
  counterObj.addedCount = addedServices.length;

  await emitDashboardUpdateSafe("counter-services-added");

  return counterObj;
};

exports.removeService = async (id, serviceId) => {
  const counter = await Counter.findById(id);

  if (!counter) {
    throw new ApiError(404, "Không tìm thấy phòng");
  }

  await assertCanRemoveServicesFromCounter(counter._id, [serviceId]);

  const deleted = await ServiceCounter.findOneAndDelete({
    serviceId,
    counterId: counter._id,
  });

  if (!deleted) {
    throw new ApiError(404, "Không tìm thấy mối quan hệ giữa phòng và quầy");
  }

  const serviceRelations = await ServiceCounter.find({
    counterId: counter._id,
    isActive: true,
  }).populate("serviceId", "name code");

  const counterObj = counter.toObject();
  counterObj.services = serviceRelations.map((rel) => rel.serviceId);

  await emitDashboardUpdateSafe("counter-service-removed");

  return counterObj;
};

exports.delete = async (id) => {
  const counter = await Counter.findById(id);

  if (!counter) {
    throw new ApiError(404, "Không tìm thấy phòng");
  }

  const [waitingCount, processingCount, assignedCount] = await Promise.all([
    Ticket.countDocuments({
      queueCounterId: counter._id,
      status: TicketStatus.WAITING,
    }),
    Ticket.countDocuments({
      counterId: counter._id,
      status: TicketStatus.PROCESSING,
    }),
    ServiceCounter.countDocuments({ counterId: counter._id }),
  ]);

  if (waitingCount > 0 || processingCount > 0) {
    throw new ApiError(
      400,
      `Không thể xóa phòng vì còn ${waitingCount} vé đang chờ và ${processingCount} vé đang xử lý.`,
    );
  }

  if (assignedCount > 0) {
    throw new ApiError(
      400,
      `Không thể xóa phòng đang có ${assignedCount} quầy được gán. Vui lòng gỡ hết quầy trước khi xóa.`,
    );
  }

  await counter.deleteOne();

  await emitDashboardUpdateSafe("counter-deleted");

  return counter;
};

exports.toggleTts = async (id) => {
  const counter = await Counter.findById(id);
  if (!counter) throw new ApiError(404, "Không tìm thấy phòng");

  counter.ttsEnabled = !counter.ttsEnabled;
  await counter.save();

  await emitDashboardUpdateSafe("counter-tts-toggled");
  return counter;
};

exports.toggleActive = async (id) => {
  const counter = await Counter.findById(id);
  if (!counter) throw new ApiError(404, "Không tìm thấy phòng");

  counter.isActive = !counter.isActive;
  await counter.save();

  await ServiceCounter.updateMany(
    { counterId: counter._id },
    { isActive: counter.isActive },
  );

  if (!counter.isActive) {
    await Ticket.updateMany(
      { counterId: counter._id, status: TicketStatus.PROCESSING },
      {
        status: TicketStatus.WAITING,
        counterId: null,
        staffId: null,
        serviceCounterId: null,
        processingAt: null,  
        isRecall: false,
        recallCounterId: null,
      },
    );
    await Counter.findByIdAndUpdate(counter._id, { currentTicketId: null });
  }

  await emitDashboardUpdateSafe("counter-toggled");
  return counter;
};

exports.getServices = async (id) => {
  const counter = await Counter.findById(id);

  if (!counter) {
    throw new ApiError(404, "Không tìm thấy phòng");
  }

  const serviceRelations = await ServiceCounter.find({
    counterId: counter._id,
    isActive: true,
  }).populate("serviceId", "code name icon description");

  return {
    counter,
    services: serviceRelations.map((rel) => rel.serviceId),
  };
};

exports.getAllStats = async () => {
  const counters = await Counter.find({ isActive: true }).sort({ number: 1 });
  if (counters.length === 0) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counterIds = counters.map((counter) => counter._id);

  const [completedTodayRows, processingRows] = await Promise.all([
    Ticket.aggregate([
      {
        $match: {
          counterId: { $in: counterIds },
          status: TicketStatus.COMPLETED,
          completedAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: "$counterId",
          count: { $sum: 1 },
        },
      },
    ]),
    Ticket.aggregate([
      {
        $match: {
          counterId: { $in: counterIds },
          status: TicketStatus.PROCESSING,
        },
      },
      {
        $group: {
          _id: "$counterId",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const completedTodayMap = new Map(
    completedTodayRows.map((row) => [String(row._id), row.count]),
  );
  const processingMap = new Map(
    processingRows.map((row) => [String(row._id), row.count]),
  );

  const stats = counters.map((counter) => ({
    counter: {
      id: counter._id,
      name: counter.name,
      number: counter.number,
    },
    totalProcessed: counter.processedCount || 0,
    completedToday: completedTodayMap.get(String(counter._id)) || 0,
    processing: processingMap.get(String(counter._id)) || 0,
  }));

  return stats.sort((a, b) => b.totalProcessed - a.totalProcessed);
};