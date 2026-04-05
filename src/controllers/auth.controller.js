const authService = require('../services/auth.service');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    res.json({ 
        success: true, 
        data: result 
    });
};