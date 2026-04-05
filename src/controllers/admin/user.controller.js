const staffService = require('../../services/staff.service');

exports.getAllStaff = async (req, res, next) => {
  const staffs = await staffService.getAllStaff();
  res.json({ success: true, data: staffs });
};

exports.getStaffById = async (req, res, next) => {
  const staff = await staffService.getStaffById(req.params.id);
  res.json({ success: true, data: staff });
};

exports.createStaff = async (req, res, next) => {
  const staff = await staffService.createStaff(req.body);
  res.status(201).json({
    success: true,
    data: staff,
    message: 'Tạo nhân viên thành công'
  });
};

exports.updateStaff = async (req, res, next) => {
  const staff = await staffService.updateStaff(req.params.id, req.body);
  res.json({ success: true, data: staff, message: 'Cập nhật thành công' });
};

exports.deleteStaff = async (req, res, next) => {
  await staffService.deleteStaff(req.params.id);
  res.json({ success: true, message: 'Xóa nhân viên thành công' });
};

exports.assignCounter = async (req, res, next) => {
  const { counterId } = req.body;
  const staff = await staffService.assignCounter(req.params.id, counterId);
  res.json({ success: true, data: staff, message: 'Đã gán quầy thành công' });
};

exports.toggleActive = async (req, res, next) => {
  const staff = await staffService.toggleActive(req.params.id);
  res.json({
    success: true,
    data: staff,
    message: `${staff.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} nhân viên thành công`
  });
};