const ApiError = require('../utils/ApiError');
const ServiceCounter = require('../models/serviceCounter.model');
const StaffService = require('../models/staffService.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');

const normalizeId = (value) => String(value?._id || value);

const getCounterServiceRelations = async (counterId) => {
  if (!counterId) {
    return [];
  }

  return ServiceCounter.find({
    counterId,
    isActive: true
  }).populate('serviceId', 'name code icon displayOrder isActive');
};

const buildServiceSnapshot = (service) => ({
  id: service._id,
  _id: service._id,
  code: service.code,
  name: service.name,
  icon: service.icon,
  displayOrder: service.displayOrder,
  isActive: service.isActive
});

const getStaffServiceAccess = async (staffId, counterId) => {
  const [counterRelations, assignments] = await Promise.all([
    getCounterServiceRelations(counterId),
    staffId
      ? StaffService.find({ staffId }).populate('serviceId', 'name code icon displayOrder isActive')
      : []
  ]);

  const availableServices = counterRelations
    .map((relation) => relation.serviceId)
    .filter(Boolean)
    .filter((service) => service.isActive)
    .map(buildServiceSnapshot);

  const availableServiceIds = availableServices.map((service) => String(service.id));
  const availableServiceIdSet = new Set(availableServiceIds);
  const serviceRestrictionConfigured = Boolean(staffId);

  const assignedServices = assignments
    .filter((assignment) =>
      assignment.isActive &&
      assignment.serviceId?.isActive &&
      availableServiceIdSet.has(normalizeId(assignment.serviceId))
    )
    .map((assignment) => buildServiceSnapshot(assignment.serviceId));

  const effectiveServices = serviceRestrictionConfigured
    ? assignedServices
    : availableServices;

  return {
    availableServices,
    availableServiceIds,
    assignedServices,
    allowedServices: effectiveServices,
    allowedServiceIds: effectiveServices.map((service) => String(service.id)),
    serviceRestrictionConfigured
  };
};

const ensureStaffHasAccessibleServices = (accessScope) => {
  if (accessScope.serviceRestrictionConfigured && accessScope.allowedServiceIds.length === 0) {
    throw new ApiError(403, 'Nhân viên chưa được gán dịch vụ nào tại quầy hiện tại');
  }
};

const ensureStaffAssignable = async (staffId) => {
  const staff = await User.findOne({ _id: staffId, role: 'staff' }).select('counterId fullName username');

  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân viên');
  }

  return staff;
};

const assignServicesToStaff = async (staffId, serviceIds = []) => {
  const normalizedServiceIds = [...new Set((serviceIds || []).map(String))];
  const staff = await ensureStaffAssignable(staffId);

  if (!staff.counterId && normalizedServiceIds.length > 0) {
    throw new ApiError(400, 'Nhân viên chưa được gán quầy nên chưa thể gán dịch vụ');
  }

  const counterAccess = await getStaffServiceAccess(null, staff.counterId);
  const availableServiceIdSet = new Set(counterAccess.availableServiceIds);
  const invalidServiceIds = normalizedServiceIds.filter((serviceId) => !availableServiceIdSet.has(serviceId));

  if (invalidServiceIds.length > 0) {
    throw new ApiError(400, 'Chỉ được gán các dịch vụ mà quầy của nhân viên đang phục vụ');
  }

  const existingAssignments = await StaffService.find({ staffId });
  const existingMap = new Map(
    existingAssignments.map((assignment) => [String(assignment.serviceId), assignment])
  );

  if (normalizedServiceIds.length === 0 && existingAssignments.length === 0) {
    await Promise.all(
      counterAccess.availableServiceIds.map((serviceId) => StaffService.create({
        staffId,
        serviceId,
        isActive: false
      }))
    );

    return getStaffServiceAccess(staffId, staff.counterId);
  }

  await Promise.all(
    normalizedServiceIds.map(async (serviceId) => {
      const existing = existingMap.get(serviceId);

      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          await existing.save();
        }
        return;
      }

      await StaffService.create({
        staffId,
        serviceId,
        isActive: true
      });
    })
  );

  await Promise.all(
    existingAssignments
      .filter((assignment) => !normalizedServiceIds.includes(String(assignment.serviceId)) && assignment.isActive)
      .map(async (assignment) => {
        assignment.isActive = false;
        await assignment.save();
      })
  );

  return getStaffServiceAccess(staffId, staff.counterId);
};

const getStaffServiceSummary = async (staffId) => {
  const staff = await ensureStaffAssignable(staffId);
  const access = await getStaffServiceAccess(staffId, staff.counterId);

  return {
    staffId: staff._id,
    counterId: staff.counterId,
    serviceRestrictionConfigured: access.serviceRestrictionConfigured,
    availableServices: access.availableServices,
    assignedServices: access.assignedServices,
    effectiveServices: access.allowedServices
  };
};

const assertStaffCanHandleService = async (staffId, counterId, serviceId) => {
  const [access, service] = await Promise.all([
    getStaffServiceAccess(staffId, counterId),
    Service.findById(serviceId).select('name code isActive')
  ]);

  if (!service) {
    console.warn(`[Permission] Dịch vụ không tồn tại — staffId=${staffId}, counterId=${counterId}, serviceId=${serviceId}`);
    throw new ApiError(404, 'Không tìm thấy dịch vụ');
  }

  if (!service.isActive) {
    console.warn(`[Permission] Dịch vụ bị vô hiệu hóa — staff=${staffId}, counter=${counterId}, service=${serviceId} (${service.name})`);
    throw new ApiError(403, `Dịch vụ ${service.name} đã bị vô hiệu hóa, không thể thực hiện thao tác này`);
  }

  if (!access.availableServiceIds.includes(String(serviceId))) {
    console.warn(`[Permission] Quầy không phục vụ dịch vụ — staff=${staffId}, counter=${counterId}, service=${serviceId} (${service.name})`);
    throw new ApiError(403, `Quầy hiện tại không phục vụ dịch vụ ${service.name}`);
  }

  if (!access.allowedServiceIds.includes(String(serviceId))) {
    console.warn(`[Permission] Nhân viên không có quyền — staff=${staffId}, counter=${counterId}, service=${serviceId} (${service.name})`);
    throw new ApiError(403, `Bạn không có quyền xử lý dịch vụ ${service.name}`);
  }

  return access;
};

module.exports = {
  getCounterServiceRelations,
  getStaffServiceAccess,
  ensureStaffHasAccessibleServices,
  assignServicesToStaff,
  getStaffServiceSummary,
  assertStaffCanHandleService
};