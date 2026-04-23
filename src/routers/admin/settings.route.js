const express = require('express');

const router = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  patchAutoResetEnabledSchema,
  patchAutoResetTimeSchema,
  patchTtsEnabledSchema
} = require('../../validations/admin-settings.validation');
const SettingsController = require('../../controllers/admin/settings.controller');

router.get('/tts', authMiddleware, adminOnly, SettingsController.getTtsEnabled);
router.patch('/tts', authMiddleware, adminOnly, validate(patchTtsEnabledSchema), SettingsController.patchTtsEnabled);
router.get('/auto-reset', authMiddleware, adminOnly, SettingsController.getAutoResetSettings);
router.patch(
  '/auto-reset/enabled',
  authMiddleware,
  adminOnly,
  validate(patchAutoResetEnabledSchema),
  SettingsController.patchAutoResetEnabled
);
router.patch(
  '/auto-reset/time',
  authMiddleware,
  adminOnly,
  validate(patchAutoResetTimeSchema),
  SettingsController.patchAutoResetTime
);

module.exports = router;
