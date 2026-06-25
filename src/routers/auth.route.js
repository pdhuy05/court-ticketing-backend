/**
 * auth.route.js  (ĐÃ CẬP NHẬT)
 *
 * Thêm:
 *  POST /api/auth/refresh  — không cần auth header
 *  POST /api/auth/logout   — cần auth header (để biết ai logout)
 *
 * Áp dụng loginLimiter cho POST /login
 */

const express    = require("express");
const router     = express.Router();
const AuthController = require("../controllers/auth.controller");
const validate       = require("../middlewares/validate.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { loginLimiter }   = require("../middlewares/rate-limit.middleware");
const { loginSchema, updateProfileSchema } = require("../validations/auth.validation");

router.post("/login",   loginLimiter, validate(loginSchema), AuthController.login);
router.post("/refresh", AuthController.refresh);

router.post("/logout",  authMiddleware, AuthController.logout);
router.get( "/me",      authMiddleware, AuthController.me);
router.put( "/profile", authMiddleware, validate(updateProfileSchema), AuthController.updateProfile);

module.exports = router;