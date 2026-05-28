const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { loginSchema, updateProfileSchema } = require('../validations/auth.validation');

router.post('/login', validate(loginSchema), AuthController.login);
router.get('/me', authMiddleware, AuthController.me);
router.put('/profile', authMiddleware, validate(updateProfileSchema), AuthController.updateProfile);

module.exports = router;