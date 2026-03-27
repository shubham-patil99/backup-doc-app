const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./src/routes');
const uploadRouter = require('./src/routes/upload');
const path = require('path');
const fs = require('fs');

const app = express();

// ----------------------------
// CORS CONFIG
// ----------------------------
const allowedOrigins = [
  'http://10.203.96.173',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:3002',
];

app.use((req, res, next) => {
  console.log('[CORS] origin=', req.headers.origin);
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-side calls, file:// and Electron (null origin)
    if (!origin || origin === 'null') return callback(null, true);

    // Allow known hosts
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow any localhost / 127.0.0.1 on any port (packaged electron uses random ports)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);

    // Deny others
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', (req, res) => {
  res.sendStatus(204);
});

// ----------------------------
// COMMON MIDDLEWARES
// ----------------------------
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------
// STATIC UPLOADS SERVING (BEFORE ROUTES)
// ----------------------------
// ✅ Serve the entire uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
console.log(`📁 Looking for uploads directory at: ${uploadsDir}`);

if (fs.existsSync(uploadsDir)) {
  console.log(`✅ Serving /uploads from: ${uploadsDir}`);
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1d', // Cache for 1 day
    etag: true,
    lastModified: true
  }));
  
  // ✅ Log all files in uploads/images for debugging
  const imagesDir = path.join(uploadsDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir);
    console.log(`📸 Found ${files.length} images in uploads/images:`, files.slice(0, 5));
  }
} else {
  console.error(`❌ Uploads directory not found: ${uploadsDir}`);
  // Create it
  fs.mkdirSync(path.join(uploadsDir, 'images'), { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// ----------------------------
// ROUTES
// ----------------------------
app.use('/api', routes);
app.use('/api/uploads', uploadRouter);

// ----------------------------
// ROOT CHECK
// ----------------------------
app.get('/', (req, res) => res.send('🚀 Server is running...'));

// ✅ Add debug route to check if file exists
app.get('/uploads/images/:filename', (req, res, next) => {
  const filePath = path.join(__dirname, 'uploads', 'images', req.params.filename);
  console.log(`🔍 Checking file: ${filePath}`);
  console.log(`   Exists: ${fs.existsSync(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ 
      error: 'File not found',
      path: filePath,
      exists: false
    });
  }
  
  // Let express.static handle it
  next();
});

// ----------------------------
// GLOBAL ERROR HANDLER
// ----------------------------
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
  res.status(500).json({ error: err.message, stack: err.stack });
});

module.exports = app;