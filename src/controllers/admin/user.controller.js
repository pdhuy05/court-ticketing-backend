const staffService = require('../../services/staff.service');

exports.getAllStaff = async (req, res) => {
  const staffs = await staffService.getAllStaff();
  res.json({ success: true, data: staffs });
};

exports.getStaffById = async (req, res) => {
  const staff = await staffService.getStaffById(req.params.id);
  res.json({ success: true, data: staff });
};

exports.createStaff = async (req, res) => {
  const staff = await staffService.createStaff(req.body);
  res.status(201).json({
    success: true,
    data: staff,
    message: 'Tạo nhân viên thành công'
  });
};

exports.updateStaff = async (req, res) => {
  const staff = await staffService.updateStaff(req.params.id, req.body);
  res.json({ success: true, data: staff, message: 'Cập nhật thành công' });
};

exports.deleteStaff = async (req, res) => {
  await staffService.deleteStaff(req.params.id);
  res.json({ success: true, message: 'Xóa nhân viên thành công' });
};

exports.assignCounter = async (req, res) => {
  const { counterId } = req.body;
  const staff = await staffService.assignCounter(req.params.id, counterId);
  res.json({ success: true, data: staff, message: 'Đã gán quầy thành công' });
};

exports.getStaffServices = async (req, res) => {
  const data = await staffService.getStaffServices(req.params.id);
  res.json({ success: true, data });
};

exports.assignServices = async (req, res) => {
  const data = await staffService.assignServices(req.params.id, req.body.serviceIds || []);
  res.json({
    success: true,
    data,
    message: 'Đã cập nhật dịch vụ cho nhân viên thành công'
  });
};

exports.toggleActive = async (req, res) => {
  const staff = await staffService.toggleActive(req.params.id);
  res.json({
    success: true,
    data: staff,
    message: `${staff.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} nhân viên thành công`
  });
};

exports.removeCounter = async (req, res, next) => {
  const staff = await staffService.removeCounter(req.params.id);
  res.json({ 
    success: true, 
    data: staff, 
    message: 'Đã gỡ quầy khỏi nhân viên thành công' 
  });
};
