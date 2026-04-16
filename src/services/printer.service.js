const net = require('net');
const sharp = require('sharp');
const QRCode = require('qrcode');
const logger = require('../utils/Logger');

const { ConnectPrint } = require('../constants/enums');

const getDisplayTicketNumber = (ticket) => ticket.displayNumber || ticket.ticketNumber || '001';

class PrinterService {
  constructor() {
    this.printers = new Map();
  }

  // ================= PRINTER =================
  addNetworkPrinter(printerId, host, port = 9100) {
    this.printers.set(printerId, {
      type: ConnectPrint.NETWORK,
      host,
      port,
    });

    logger.success(`Đã thêm máy in NETWORK: ${printerId} (${host}:${port})`);
  }

  hasPrinter(printerId) {
    return this.printers.has(printerId);
  }

  getPrinters() {
    return Array.from(this.printers.entries()).map(([id, printer]) => ({
      id,
      type: printer.type,
      host: printer.host,
      port: printer.port,
    }));
  }

  // ================= QR =================
  async generateQRCode(ticket, service) {
    const qrText = `
SỐ THỨ TỰ: ${getDisplayTicketNumber(ticket)}
YÊU CẦU: ${service?.name || ''}
ĐƯƠNG SỰ: ${ticket.name || ''}
ĐIỆN THOẠI: ${ticket.phone || ''}
THỜI GIAN: ${new Date(ticket.createdAt).toLocaleString('vi-VN')}
    `.trim();

    return QRCode.toBuffer(qrText, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
    });
  }

  // ================= TẠO SVG LAYOUT =================
  generateSVG(ticket, service, qrBuffer) {
    const width = 576;
    const height = 1080;

    const timeStr = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const qrBase64 = qrBuffer 
      ? `data:image/png;base64,${qrBuffer.toString('base64')}` 
      : '';

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        
        <!-- HEADER -->
        <text x="50%" y="45" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="bold" fill="black">TÒA ÁN NHÂN DÂN KHU VỰC 1</text>
        <text x="50%" y="78" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="black">TP. HỒ CHÍ MINH</text>

        <!-- TIME -->
        <text x="50%" y="130" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="black">${timeStr}</text>

        <!-- TICKET NUMBER -->
        <text x="50%" y="320" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="200" font-weight="bold" fill="black">${getDisplayTicketNumber(ticket)}</text>

        <!-- SERVICE NAME -->
        <text x="50%" y="410" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="bold" fill="black">- ${service?.name || 'Dịch vụ'} -</text>

        <!-- Dashed Line 1 -->
        <line x1="60" y1="450" x2="${width - 60}" y2="450" stroke="black" stroke-width="2" stroke-dasharray="6,4"/>

        <!-- QR TITLE -->
        <text x="50%" y="505" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="bold" fill="black">THÔNG TIN ĐƯƠNG SỰ</text>

        <!-- QR CODE -->
        <image 
          x="${(width - 260) / 2}" 
          y="535" 
          width="260" 
          height="260" 
          href="${qrBase64}"
        />

        <!-- CUSTOMER NAME -->
        <text x="50%" y="835" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="bold" fill="black">${ticket.name || 'Đương sự'}</text>

        <!-- SCAN INSTRUCTION -->
        <text x="50%" y="870" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="black">Quét mã để xem chi tiết</text>

        <!-- Dashed Line 2 -->
        <line x1="60" y1="910" x2="${width - 60}" y2="910" stroke="black" stroke-width="2" stroke-dasharray="6,4"/>

        <!-- FOOTER -->
        <text x="50%" y="970" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="bold" fill="black">CẢM ƠN QUÝ ÔNG BÀ</text>
        <text x="50%" y="1010" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="black">Vui lòng chờ đến lượt</text>
      </svg>
    `;
  }

  // ================= CONVERT SVG TO ESC/POS =================
  async convertToEscPos(svgBuffer, printWidth) {
    const pngBuffer = await sharp(svgBuffer)
      .png()
      .toBuffer();

    const { data, info } = await sharp(pngBuffer)
      .resize({ width: printWidth, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .threshold(135)
      .sharpen()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const bytesPerLine = Math.ceil(width / 8);

    const header = Buffer.from([
      0x1d, 0x76, 0x30, 0x00,
      bytesPerLine & 0xff,
      (bytesPerLine >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
    ]);

    const imageData = Buffer.alloc(bytesPerLine * height);
    let pos = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < bytesPerLine; x++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = x * 8 + bit;
          if (px >= width) continue;
          const idx = y * width + px;
          if (data[idx] < 128) {
            byte |= 1 << (7 - bit);
          }
        }
        imageData[pos++] = byte;
      }
    }

    return Buffer.concat([header, imageData]);
  }

  // ================= PRINT =================
  async printTicket(printerId, ticket, service) {
    const printer = this.printers.get(printerId);
    if (!printer) {
      throw new Error(`Máy in ${printerId} chưa được cấu hình`);
    }

    const qrBuffer = await this.generateQRCode(ticket, service);
    const svg = this.generateSVG(ticket, service, qrBuffer);
    const imageBuffer = await this.convertToEscPos(Buffer.from(svg), 576);

    return this.printNetwork(printer, imageBuffer);
  }

  async testPrint(printerId) {
    return this.printTicket(
      printerId,
      {
        ticketNumber: '001',
        name: 'Nguyễn Văn A',
        phone: '0912345678',
        createdAt: new Date(),
        status: 'waiting',
      },
      {
        name: 'NỘP ĐƠN',
        code: 'ND',
      }
    );
  }

  printNetwork(printer, imageBuffer) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(
        { host: printer.host, port: printer.port },
        () => {
          const init = Buffer.from([0x1b, 0x40, 0x1b, 0x33, 0x00]);
          const center = Buffer.from([0x1b, 0x61, 0x01]);
          const feed = Buffer.from([0x0a, 0x0a, 0x0a]);
          const cut = Buffer.from([0x1d, 0x56, 0x42, 0x00]);

          client.write(init);
          client.write(center);
          client.write(imageBuffer, () => {
            client.write(feed);
            client.write(cut);
            setTimeout(() => {
              client.end();
              resolve({
                success: true,
                message: 'In ticket thành công',
              });
            }, 300);
          });
        }
      );

      client.on('error', (err) => {
        reject(new Error(`Kết nối thất bại: ${err.message}`));
      });

      client.setTimeout(10000, () => {
        client.destroy();
        reject(new Error('Timeout khi kết nối máy in'));
      });
    });
  }
}

module.exports = new PrinterService();
