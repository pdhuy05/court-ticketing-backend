const net = require('net');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const { ConnectPrint } = require('../constants/enums');

class PrinterService {
  constructor() {
    this.printers = new Map();
  }

  // ==================== ADD PRINTER ====================
  addNetworkPrinter(printerId, host, port = 9100) {
    this.printers.set(printerId, {
      type: ConnectPrint.NETWORK,
      host,
      port,
    });

    console.log(
      `✅ Đã thêm máy in NETWORK: ${printerId} (${host}:${port})`
    );
  }

  hasPrinter(printerId) {
    return this.printers.has(printerId);
  }

  // ==================== TẠO ẢNH TICKET ====================
  async createTicketImage(ticket, service) {
    const width = 384;
    const height = 820;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // ===== BACKGROUND =====
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#000000';

    let y = 20;

    // ===== HEADER =====
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial';

    ctx.fillText('TÒA ÁN NHÂN DÂN KHU VỰC 1', width / 2, y);
    ctx.fillText('THÀNH PHỐ HỒ CHÍ MINH', width / 2, y + 26);

    y += 60;

    // ===== TIME =====
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    ctx.font = '20px Arial';
    ctx.fillText(timeStr, width / 2, y);

    y += 110;

    // ===== TICKET NUMBER =====
    ctx.font = 'bold 75px Arial';
    ctx.fillText(ticket.ticketNumber || 'A001', width / 2, y);

    y += 70;

    // ===== SERVICE NAME =====
    const serviceName = service?.name || 'Dịch vụ';

    ctx.font = 'bold 42px Arial';

    this.drawMultilineText(
      ctx,
      `- ${serviceName} -`,
      width / 2,
      y,
      320,
      46
    );

    y += 70;

    // ===== LINE 1 =====
    this.drawDashedLine(ctx, 35, y, width - 35);

    y += 40;

    // ===== QR CODE =====
    try {
      const qrPath = path.join(
        __dirname,
        '../public/images/qr-code.png'
      );

      const qrImage = await loadImage(qrPath);

      const qrSize = 145;
      const qrX = (width - qrSize) / 2;

      ctx.drawImage(qrImage, qrX, y, qrSize, qrSize);

      ctx.font = '16px Arial';
      ctx.fillText(
        'Thông tin của đương sự',
        width / 2,
        y + qrSize + 20
      );

      ctx.font = '14px Arial';
      ctx.fillText(
        'Quét mã QR để biết thêm thông tin',
        width / 2,
        y + qrSize + 40
      );
    } catch (err) {
      console.error('❌ Không load được QR Code:', err.message);

      ctx.font = 'bold 18px Arial';
      ctx.fillText('[ QR CODE ]', width / 2, y + 80);
    }

    y += 200;

    // ===== LINE 2 =====
    this.drawDashedLine(ctx, 35, y, width - 35);

    y += 50;

    // ===== FOOTER =====
    ctx.font = 'bold 19px Arial';
    ctx.fillText('CẢM ƠN QUÝ ÔNG BÀ!', width / 2, y);

    y += 35;

    ctx.font = '17px Arial';
    ctx.fillText('Vui lòng chờ đến lượt', width / 2, y);

    y += 35;

    const buffer = canvas.toBuffer('image/png');
    return this.convertToEscPos(buffer, width);
  }

  // ==================== HELPER ====================
  drawDashedLine(ctx, x1, y, x2) {
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawMultilineText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let offsetY = 0;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const { width } = ctx.measureText(testLine);

      if (width > maxWidth && i > 0) {
        ctx.fillText(line, x, y + offsetY);
        line = words[i] + ' ';
        offsetY += lineHeight;
      } else {
        line = testLine;
      }
    }

    ctx.fillText(line, x, y + offsetY);
  }

  // ==================== ESC/POS ====================
  async convertToEscPos(imageBuffer, printWidth) {
    const { data, info } = await sharp(imageBuffer)
      .resize(printWidth, null, { fit: 'contain' })
      .grayscale()
      .trim()
      .threshold(118)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const bytesPerLine = Math.ceil(width / 8);

    const header = Buffer.from([
      0x1d,
      0x76,
      0x30,
      0x00,
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

          if (px < width) {
            const idx = y * width + px;

            if (data[idx] < 128) {
              byte |= 1 << (7 - bit);
            }
          }
        }

        imageData[pos++] = byte;
      }
    }

    return Buffer.concat([header, imageData]);
  }

  // ==================== PRINT ====================
  async printTicket(printerId, ticket, service) {
    const printer = this.printers.get(printerId);

    if (!printer) {
      throw new Error(`Máy in ${printerId} chưa được cấu hình`);
    }

    const imageBuffer = await this.createTicketImage(
      ticket,
      service
    );

    return this.printNetwork(printer, imageBuffer);
  }

  async testPrint(printerId) {
    return this.printTicket(
      printerId,
      {
        ticketNumber: 'A001',
        name: 'Nguyễn Văn A',
        gender: 'male',
      },
      { name: 'Nhận đơn ly hôn' }
    );
  }

  printNetwork(printer, imageBuffer) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(
        {
          host: printer.host,
          port: printer.port,
        },
        () => {
          // ===== INIT =====
          const init = Buffer.from([
            0x1b,
            0x40,
            0x1b,
            0x33,
            0x00,
          ]);

          const center = Buffer.from([0x1b, 0x61, 0x01]);

          const feed = Buffer.from([0x0a, 0x0a, 0x0a]);

          const cut = Buffer.from([
            0x1d,
            0x56,
            0x42,
            0x00,
          ]);

          // ===== SEND DATA =====
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

      // ===== ERROR =====
      client.on('error', (err) => {
        reject(new Error(`Kết nối thất bại: ${err.message}`));
      });

      // ===== TIMEOUT =====
      client.setTimeout(10000, () => {
        client.destroy();
        reject(new Error('Timeout khi kết nối máy in'));
      });
    });
  }

  getPrinters() {
    return Array.from(this.printers.entries()).map(
      ([id, p]) => ({
        id,
        type: p.type,
        host: p.host,
        port: p.port,
      })
    );
  }
}

module.exports = new PrinterService();