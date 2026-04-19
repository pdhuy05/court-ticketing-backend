const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { patchTtsEnabledSchema } = require('../../validations/admin-settings.validation');
const SettingsController = require('../../controllers/admin/settings.controller');

router.get('/tts', authMiddleware, adminOnly, SettingsController.getTtsEnabled);
router.patch('/tts', authMiddleware, adminOnly, validate(patchTtsEnabledSchema), SettingsController.patchTtsEnabled );

module.exports = router;
