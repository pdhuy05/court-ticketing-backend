const QRCode = require('qrcode');

class QRService {
  /**
   * Tạo QR code từ dữ liệu ticket
   * @param {Object} ticket - Thông tin ticket
   * @returns {Promise<string>} - Data URL của QR code
   */
  static async generateTicketQR(ticket) {
    const qrData = {
      ticketNumber: ticket.ticketNumber,
      serviceCode: ticket.serviceId?.code,
      serviceName: ticket.serviceId?.name,
      customerName: ticket.phone,
      createdAt: ticket.createdAt,
      status: ticket.status
    };

    // Tạo QR code dạng Data URL (base64)
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200
    });

    return qrCodeDataURL;
  }

  /**
   * Tạo QR code từ text đơn giản
   */
  static async generateTextQR(text) {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      width: 200
    });
  }

  /**
   * Tạo QR code dạng Buffer để in
   */
  static async generateTicketQRBuffer(ticket) {
    const qrData = {
      ticketNumber: ticket.ticketNumber,
      serviceId: ticket.serviceId?._id,
      customerName: ticket.customerName,
      createdAt: ticket.createdAt
    };

    return await QRCode.toBuffer(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 150
    });
  }
}

module.exports = QRService;