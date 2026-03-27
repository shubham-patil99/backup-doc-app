// src/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ----------------------------
// Uploads Directory Setup
// ----------------------------
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
}

// ----------------------------
// Multer Configuration
// ----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const validExt = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const validMime = allowedTypes.test(file.mimetype);
    if (validExt && validMime) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
  },
});

// ----------------------------
// Upload Route
// ----------------------------
router.post('/image', upload.any(), (req, res) => {
  try {
    const file = (Array.isArray(req.files) && req.files[0]) || req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded', files: [] });

    
    // ✅ Ensure no double slashes
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/images/${file.filename}`;

    console.log(`✅ Image uploaded: ${fileUrl}`);
    console.log(`   File path: ${file.path}`);
    console.log(`   Base URL: ${baseUrl}`);

    return res.json({
      success: true,
      url: fileUrl,
      file: fileUrl,
      files: [fileUrl],
      data: { files: [fileUrl], isImages: [true] },
      message: 'Image uploaded successfully',
    });
  } catch (err) {
    console.error('❌ Upload error:', err);
    return res.status(500).json({ success: false, error: 'Upload failed', message: err.message, files: [] });
  }
});

// ----------------------------
// Multer Error Handler
// ----------------------------
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.', files: [] });
  }
  if (err) return res.status(400).json({ success: false, error: err.message, files: [] });
  next();
});

module.exports = router;