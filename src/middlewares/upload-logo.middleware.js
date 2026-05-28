const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const logoDir = path.join(__dirname, '../public/logo');

if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh: JPG, PNG, WEBP, SVG'), false);
  }
};

const uploadLogoMulter = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('logo');

const uploadLogo = (req, res, next) => {
  uploadLogoMulter(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next();

    try {
      const filename = `logo_${Date.now()}.webp`;
      const outputPath = path.join(logoDir, filename);
      
      if (req.file.mimetype === 'image/svg+xml') {
        const svgFilename = `logo_${Date.now()}.svg`;
        const svgPath = path.join(logoDir, svgFilename);
        fs.writeFileSync(svgPath, req.file.buffer);
        req.file.filename = svgFilename;
        req.file.path = svgPath;
        return next();
      }

      await sharp(req.file.buffer)
        .resize(400, 400, {
          fit: 'inside',       
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(outputPath);

      req.file.filename = filename;
      req.file.path = outputPath;

      next();
    } catch (sharpErr) {
      next(sharpErr);
    }
  });
};

module.exports = uploadLogo;