const rateLimit = require("express-rate-limit");

const jsonHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    message,
    retryAfter: res.getHeader("Retry-After"),
  });
};

const ticketLimiter = rateLimit({
  windowMs: 60 * 1000,        
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: jsonHandler(
    "Bạn đã tạo quá nhiều vé trong thời gian ngắn. Vui lòng thử lại sau 1 phút.",
  ),
});

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const username = req.body?.username?.toLowerCase?.() || "";
    return `${req.ip}:${username}`;
  },
  skipSuccessfulRequests: true, 
  handler: jsonHandler(
    "Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau 5 phút.",
  ),
});

const staffApiLimiter = rateLimit({
  windowMs: 60 * 1000,        
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: jsonHandler(
    "Quá nhiều yêu cầu. Vui lòng chờ vài giây rồi thử lại.",
  ),
});

module.exports = { ticketLimiter, loginLimiter, staffApiLimiter };