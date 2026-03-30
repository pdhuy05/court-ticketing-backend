const Service = require('../services/service.service');

exports.getAllService = async (req, res) => {
    const services = await Service.getAll();
    res.json({ success: true, data: services });
};

exports.getActiveService = async (req, res) => {
    const services = await Service.getActive();
    res.json({
        success: true,
        count: services.length,
        data: services
    });
};

exports.createService = async (req, res) => {
    const service = await Service.create(req.body);
    res.status(201).json({
        success: true,
        data: service,
        message: 'Tạo dịch vụ thành công'
    });
};

exports.updateService = async (req, res) => {
    const service = await Service.update(req.params.id, req.body);
    res.json({
        success: true,
        data: service,
        message: "Cập nhật dịch vụ thành công",
    });
};

exports.deleteService = async (req, res) => {
    const service = await Service.remove(req.params.id);
    res.json({
        success: true,
        message: "Xóa thành công",
        data: service
    });
};