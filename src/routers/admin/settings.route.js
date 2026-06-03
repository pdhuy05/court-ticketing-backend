const express = require('express');

const adminRouter = express.Router();
const publicRouter = express.Router();
const { authMiddleware, adminOnly } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const uploadLogo = require('../../middlewares/upload-logo.middleware');
const {
  patchAutoResetEnabledSchema,
  patchAutoResetTimeSchema,
  patchTtsEnabledSchema,
  patchSiteConfigSchema,
  patchDisplayModeSchema,
} = require('../../validations/admin-settings.validation');
const SettingsController = require('../../controllers/admin/settings.controller');

adminRouter.get('/tts', authMiddleware, adminOnly, SettingsController.getTtsEnabled);
adminRouter.patch('/tts', authMiddleware, adminOnly, validate(patchTtsEnabledSchema), SettingsController.patchTtsEnabled);
adminRouter.get('/auto-reset', authMiddleware, adminOnly, SettingsController.getAutoResetSettings);
adminRouter.patch('/auto-reset/enabled', authMiddleware, adminOnly, validate(patchAutoResetEnabledSchema), SettingsController.patchAutoResetEnabled);
adminRouter.patch('/auto-reset/time', authMiddleware, adminOnly, validate(patchAutoResetTimeSchema), SettingsController.patchAutoResetTime);
adminRouter.get('/site-config', authMiddleware, adminOnly, SettingsController.getSiteConfig);
adminRouter.patch('/site-config', authMiddleware, adminOnly, validate(patchSiteConfigSchema), SettingsController.patchSiteConfig);
adminRouter.post( '/upload-logo', authMiddleware, adminOnly, uploadLogo, SettingsController.uploadLogo );
adminRouter.get('/display-mode', authMiddleware, adminOnly, SettingsController.getDisplayMode);
adminRouter.patch('/display-mode', authMiddleware, adminOnly, validate(patchDisplayModeSchema), SettingsController.patchDisplayMode);

publicRouter.get('/site-config', SettingsController.getSiteConfig);
publicRouter.get('/display-mode', SettingsController.getDisplayMode);

module.exports = { adminRouter, publicRouter };