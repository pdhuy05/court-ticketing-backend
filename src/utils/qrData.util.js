const jwt = require('jsonwebtoken');
const ApiError = require('./ApiError');

const getQRSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, 'Thiếu cấu hình JWT_SECRET');
  }

  return process.env.JWT_SECRET;
};

const getQRExpiresIn = () => process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '24h';

const generateQRData = (ticket, service, displayNumber) => {
  const issuedAt = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      ticketId: String(ticket._id),
      displayNumber,
      serviceName: service?.name || '',
      serviceCode: service?.code || '',
      customerName: ticket?.name || '',
      customerPhone: ticket?.phone || '',
      issuedAt
    },
    getQRSecret(),
    {
      expiresIn: getQRExpiresIn()
    }
  );
};

const verifyQRData = (qrData) => {
  try {
    return jwt.verify(qrData, getQRSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'QR code đã hết hạn');
    }

    throw new ApiError(400, 'QR code không hợp lệ');
  }
};

module.exports = {
  generateQRData,
  verifyQRData
};
