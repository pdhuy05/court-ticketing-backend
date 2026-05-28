const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    res.json({ 
        success: true, 
        data: result 
    });
};

exports.me = async (req, res) => {
    const user = await authService.getMe(req.user._id);

    res.json({
        success: true,
        data: user
    });
};

exports.updateProfile = async (req, res) => {
    const user = await authService.updateMyProfile(req.user._id, req.body);

    res.json({
        success: true,
        data: user,
        message: 'Cập nhật hồ sơ thành công'
    });
};

Object.keys(module.exports).forEach((key) => {
    module.exports[key] = asyncHandler(module.exports[key]);
});