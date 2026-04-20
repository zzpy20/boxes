'use strict';
const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app        = express();
const PORT       = parseInt(process.env.PORT  || '3000', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN      || 'changeme';
const DATA_DIR   = process.env.DATA_DIR        || path.join(__dirname, 'data');
const FILES_DIR  = path.join(DATA_DIR, 'files');
const INDEX_FILE = path.join(DATA_DIR, 'search-index.json');
const BOXES_FILE = path.join(DATA_DIR, 'boxes.json');

// Ensure data directories exist on startup
fs.mkdirSync(FILES_DIR, { recursive: true });

// Seed boxes.json into data dir on first run
if (!fs.existsSync(BOXES_FILE)) {
  const template = path.join(__dirname, 'boxes.json');
  if (fs.existsSync(template)) fs.copyFileSync(template, BOXES_FILE);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeSegment(s) {
  s = String(s || '').replace(/\\/g, '/').split('/').pop() || '';
  s = s.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 180);
  return s || 'file';
}
function sanitizePath(p) {
  return String(p || '').split('/').map(sanitizeSegment).filter(Boolean).join('/') || 'file';
}
function boxDir(id) { return path.join(FILES_DIR, 'box-' + id); }
function ensureBoxDir(id) { fs.mkdirSync(boxDir(id), { recursive: true }); }

function listRecursive(dir, base) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) { out.push(...listRecursive(path.join(dir, entry.name), rel)); }
    else { out.push(rel); }
  }
  return out;
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/html', 'text/plain'], limit: '2mb' }));

function auth(req, res, next) {
  if (req.query.t !== AUTH_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// ── Config injection — must come BEFORE static middleware ─────────────────────
// Tells the frontend to use relative URLs instead of the Cloudflare worker URL
app.get('/api-config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send('window.__BOXES_API_BASE__="";');
});

// ── boxes.json (served from data dir so it survives edits) ────────────────────
app.get('/boxes.json', (req, res) => {
  const file = fs.existsSync(BOXES_FILE) ? BOXES_FILE : path.join(__dirname, 'boxes.json');
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(file);
});
app.post('/boxes.json', auth, (req, res) => {
  try {
    fs.writeFileSync(BOXES_FILE, JSON.stringify(req.body, null, 2));
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ── Auth check (GET /*?check=1&t=TOKEN) ───────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.query.check !== '1') return next();
  return req.query.t === AUTH_TOKEN
    ? res.json({ ok: true })
    : res.status(401).json({ error: 'unauthorized' });
});

// ── Search index ──────────────────────────────────────────────────────────────
app.get('/search-index', auth, (req, res) => res.json(readJSON(INDEX_FILE, [])));
app.post('/search-index', auth, (req, res) => {
  try { fs.writeFileSync(INDEX_FILE, JSON.stringify(req.body)); return res.json({ ok: true }); }
  catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── File list ─────────────────────────────────────────────────────────────────
const SKIP = new Set(['_meta', 'note', '_cover']);
app.get('/media/box-:id/list', auth, (req, res) => {
  const dir = boxDir(req.params.id);
  ensureBoxDir(req.params.id);
  const files = listRecursive(dir, '').filter(n => !SKIP.has(n) && !n.startsWith('_trash/'));
  const result = files.map(name => {
    const stat = fs.statSync(path.join(dir, name));
    return { name, size: stat.size, lastModified: stat.mtime.toISOString() };
  });
  return res.json(result);
});

// ── Note ──────────────────────────────────────────────────────────────────────
app.get('/media/box-:id/note', auth, (req, res) => {
  const file = path.join(boxDir(req.params.id), 'note');
  if (!fs.existsSync(file)) return res.status(404).send('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(fs.readFileSync(file, 'utf8'));
});
app.post('/media/box-:id/note', auth, (req, res) => {
  ensureBoxDir(req.params.id);
  fs.writeFileSync(path.join(boxDir(req.params.id), 'note'), req.body || '', 'utf8');
  return res.json({ ok: true });
});

// ── Metadata ──────────────────────────────────────────────────────────────────
app.get('/media/box-:id/_meta', auth, (req, res) =>
  res.json(readJSON(path.join(boxDir(req.params.id), '_meta'), {})));
app.post('/media/box-:id/_meta', auth, (req, res) => {
  ensureBoxDir(req.params.id);
  fs.writeFileSync(path.join(boxDir(req.params.id), '_meta'), JSON.stringify(req.body));
  return res.json({ ok: true });
});

// ── Cover ─────────────────────────────────────────────────────────────────────
app.get('/media/box-:id/_cover', auth, (req, res) => {
  const file = path.join(boxDir(req.params.id), '_cover');
  if (!fs.existsSync(file)) return res.status(404).send('');
  return res.send(fs.readFileSync(file, 'utf8'));
});
app.post('/media/box-:id/_cover', auth, (req, res) => {
  ensureBoxDir(req.params.id);
  fs.writeFileSync(path.join(boxDir(req.params.id), '_cover'), req.body || '', 'utf8');
  return res.json({ ok: true });
});

// ── Upload ────────────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
app.post('/media/box-:id/upload', auth, upload.array('files'), (req, res) => {
  const { id } = req.params;
  const folder = req.query.folder ? sanitizePath(req.query.folder) : '';
  ensureBoxDir(id);
  for (const file of req.files || []) {
    const clean = sanitizeSegment(file.originalname);
    const rel   = folder ? folder + '/' + clean : clean;
    const dest  = path.join(boxDir(id), rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.buffer);
  }
  return res.json({ ok: true, saved: (req.files || []).length });
});

// ── Clear all ─────────────────────────────────────────────────────────────────
app.delete('/media/box-:id', auth, (req, res) => {
  if (req.query.all !== '1') return res.status(400).json({ error: 'missing all=1' });
  const dir = boxDir(req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return res.json({ ok: true });
});

// ── Delete one file ───────────────────────────────────────────────────────────
app.delete('/media/box-:id/file', auth, (req, res) => {
  const file = path.join(boxDir(req.params.id), sanitizePath(req.query.name || ''));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return res.json({ ok: true });
});

// ── Delete folder ─────────────────────────────────────────────────────────────
app.delete('/media/box-:id/folder', auth, (req, res) => {
  const dir = path.join(boxDir(req.params.id), sanitizeSegment(req.query.name || ''));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return res.json({ ok: true });
});

// ── Rename / Move (same logic — copy then delete not needed; fs.rename is atomic) ──
function moveHandler(req, res) {
  const from = sanitizePath(req.query.from || '');
  const to   = sanitizePath(req.query.to   || '');
  const dir  = boxDir(req.params.id);
  const src  = path.join(dir, from);
  const dst  = path.join(dir, to);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'not_found' });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  return res.json({ ok: true });
}
app.post('/media/box-:id/rename', auth, moveHandler);
app.post('/media/box-:id/move',   auth, moveHandler);

// ── Serve file ────────────────────────────────────────────────────────────────
app.get('/media/box-:id/*', auth, (req, res) => {
  const rel  = sanitizePath(req.params[0] || '');
  const file = path.join(boxDir(req.params.id), rel);
  if (!fs.existsSync(file)) return res.status(404).send('not found');
  return res.sendFile(file);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nBoxes is running → http://localhost:${PORT}`);
  console.log(`Auth token      : ${AUTH_TOKEN}`);
  console.log(`Data directory  : ${DATA_DIR}\n`);
});
