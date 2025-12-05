const express = require('express');
const bodyParser = require('body-parser');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const { triggerBuild, getJobStatus } = require('./services/ghaBuilder');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const UPLOADS = path.join(__dirname, 'uploads');
const FIREBASE_DIR = path.join(UPLOADS, 'firebase');
const ICON_DIR = path.join(UPLOADS, 'icons');
const OUTPUT_DIR = path.join(UPLOADS, 'output');

[UPLOADS, FIREBASE_DIR, ICON_DIR, OUTPUT_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'firebase') cb(null, FIREBASE_DIR);
    else if (file.fieldname === 'icon') cb(null, ICON_DIR);
    else cb(null, UPLOADS);
  },
  filename: function (req, file, cb) {
    const id = Date.now() + '-' + uuidv4();
    cb(null, id + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });


// -----------------------------
// 🔥 Upload Firebase JSON
// -----------------------------
app.post('/api/upload/firebase', upload.single('firebase'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const rel = path.relative(__dirname, req.file.path);
  res.json({ status: 'ok', path: rel });
});


// -----------------------------
// 🔥 Upload icon
// -----------------------------
app.post('/api/upload/icon', upload.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  const rel = path.relative(__dirname, req.file.path);
  const url = `${process.env.PUBLIC_URL}/${rel}`;

  res.json({ status: 'ok', path: rel, url });
});



// -----------------------------
// 🔥 Build Trigger
// -----------------------------
async function startBuild(cfg) {
  // cfg 包含 appName, packageName, iconPath 等所有字段
  return await triggerBuild(cfg);
}

app.post('/api/build', async (req, res) => {
  try {
    const cfg = req.body;
    const jobId = await triggerBuild(cfg);
    res.json({ status: 'queued', jobId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});


// -----------------------------
// 🔥 Build status
// -----------------------------
app.get('/api/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const st = getJobStatus(jobId);
  if (!st) return res.status(404).json({ error: 'not found' });
  res.json(st);
});


// -----------------------------
// 🔥 Serve APK downloads
// -----------------------------
app.use('/downloads', express.static(OUTPUT_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`build server listening on ${PORT}`);
});
