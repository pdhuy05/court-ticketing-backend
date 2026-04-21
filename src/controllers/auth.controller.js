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

Object.keys(module.exports).forEach((key) => {
    module.exports[key] = asyncHandler(module.exports[key]);
});
