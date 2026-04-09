const Service = require('../services/service.service');

exports.getAllService = async (req, res) => {
    const services = await Service.getAll();
    res.json({ 
        success: true, 
        data: services 
    });
};

exports.getActiveService = async (req, res) => {
    const services = await Service.getActive();
    res.json({
      success: true,
      count: services.length,
      data: services
    });
};

exports.getServiceById = async (req, res) => {
    const service = await Service.getById(req.params.id);
    res.json({
      success: true,
      data: service
    });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
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

exports.addCounters = async (req, res) => {
    const { counterIds } = req.body;
    
    if (!counterIds || !Array.isArray(counterIds) || counterIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp danh sách quầy cần thêm'
      });
    }
    
    const result = await Service.addCounters(req.params.id, counterIds);
    
    res.json({
      success: true,
      data: result,
      message: `Thêm ${result.addedCounters} quầy vào dịch vụ thành công`
    });
};

exports.removeCounter = async (req, res) => {
    const { counterId } = req.params;
    const result = await Service.removeCounter(req.params.id, counterId);
    
    res.json({
      success: true,
      data: result,
      message: 'Xóa quầy khỏi dịch vụ thành công'
    });
};

exports.getCountersByService = async (req, res) => {
    const result = await Service.getCounters(req.params.id);
    
    res.json({
      success: true,
      data: result
    });
};

exports.getStats = async (req, res) => {
    const stats = await Service.getStats(req.params.id);
    res.json({
      success: true,
      data: stats
    });
};