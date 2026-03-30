const Counter = require('../models/counter.model');

exports.getAll = async (req, res) => {
    try {
        const counters = await Counter.find()
            .populate('serviceId', 'code name icon displayOrder')
            .sort({ code: 1 });
        
        res.json({
            success: true,
            data: counters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.create = async (req, res) => {
    try {
        const { name, code, number, serviceId, note, isActive } = req.body;

        if (!serviceId) {
            return res.status(400).json({
                success: false,
                message: 'Phải chọn dịch vụ cho quầy'
            });
        }

        const existing = await Counter.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Mã quầy đã tồn tại'
            });
        }

        // Kiểm tra service có tồn tại không (tùy chọn)
        // const serviceExists = await Service.findById(serviceId);
        // if (!serviceExists) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });

        const counter = await Counter.create({
            name,
            code: code.toUpperCase(),
            number: number || 1,           // số quầy (bắt buộc trong schema)
            serviceId,
            note: note || '',
            isActive: isActive !== undefined ? isActive : true
        });

        await counter.populate('serviceId', 'name code');

        res.status(201).json({
            success: true,
            data: counter,
            message: `Tạo quầy ${name} (${counter.code}) thành công`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { name, number, isActive, note } = req.body;   // không cho phép đổi serviceId dễ dàng

        const updateData = { name, number, isActive, note };
        // Loại bỏ các trường undefined
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có dữ liệu để cập nhật'
            });
        }

        const counter = await Counter.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('serviceId', 'name code');

        if (!counter) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quầy'
            });
        }

        res.json({
            success: true,
            data: counter,
            message: 'Cập nhật quầy thành công'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addService = async (req, res) => {
    try {
        const { serviceId } = req.body;
        const counter = await Counter.findById(req.params.id);
        
        if (!counter) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quầy'
            });
        }
        
        if (!counter.serviceIds.includes(serviceId)) {
            counter.serviceIds.push(serviceId);
            await counter.save();
            await counter.populate('serviceIds', 'name code');
        }
        
        res.json({
            success: true,
            data: counter,
            message: 'Thêm dịch vụ vào quầy thành công'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.removeService = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const counter = await Counter.findById(req.params.id);
        
        if (!counter) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quầy'
            });
        }
        
        counter.serviceIds = counter.serviceIds.filter(
            id => id.toString() !== serviceId
        );
        
        await counter.save();
        await counter.populate('serviceIds', 'name code');
        
        res.json({
            success: true,
            data: counter,
            message: 'Xóa dịch vụ khỏi quầy thành công'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.delete = async (req, res) => {
    try {
        const counter = await Counter.findByIdAndDelete(req.params.id);
        
        if (!counter) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quầy'
            });
        }
        
        res.json({
            success: true,
            message: `Xóa quầy ${counter.name} thành công`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.toggleActive = async (req, res) => {
    try {
        const counter = await Counter.findById(req.params.id);
        
        if (!counter) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy quầy'
            });
        }
        
        counter.isActive = !counter.isActive;
        await counter.save();
        
        res.json({
            success: true,
            data: counter,
            message: `${counter.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} quầy ${counter.name} thành công`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}