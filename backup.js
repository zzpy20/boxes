'use strict';
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// Load .env
require('dotenv').config();

const {
  CF_ACCOUNT_ID,
  CF_R2_BUCKET,
  CF_R2_ACCESS_KEY_ID,
  CF_R2_SECRET_ACCESS_KEY,
  CF_KV_NAMESPACE_ID,
  CF_API_TOKEN,
} = process.env;

const BACKUP_DIR = path.join(__dirname, 'backup-staging');
const FILES_DIR  = path.join(BACKUP_DIR, 'files');

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString().slice(0,19)}] ${msg}`); }

function httpsGet(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${token}` } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Validate env
  const missing = ['CF_ACCOUNT_ID','CF_R2_BUCKET','CF_R2_ACCESS_KEY_ID','CF_R2_SECRET_ACCESS_KEY','CF_KV_NAMESPACE_ID','CF_API_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing .env values:', missing.join(', ')); process.exit(1); }

  log('Starting Cloudflare → Docker backup');

  // Clean staging dir
  if (fs.existsSync(BACKUP_DIR)) fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });

  // ── 1. Export search index from KV ────────────────────────────────────────
  log('Exporting search index from KV...');
  const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/sys%3Asearch-index`;
  const kvRes = await httpsGet(kvUrl, CF_API_TOKEN);
  if (kvRes.status !== 200) {
    console.error('KV export failed:', kvRes.status, kvRes.body);
    process.exit(1);
  }
  fs.writeFileSync(path.join(BACKUP_DIR, 'search-index.json'), kvRes.body);
  log('Search index exported ✓');

  // ── 2. Download all files from R2 ─────────────────────────────────────────
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     CF_R2_ACCESS_KEY_ID,
      secretAccessKey: CF_R2_SECRET_ACCESS_KEY,
    },
  });

  log('Listing R2 objects...');
  let total = 0, continuationToken;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: CF_R2_BUCKET,
      ContinuationToken: continuationToken,
    }));

    for (const obj of list.Contents || []) {
      const key  = obj.Key;
      const dest = path.join(FILES_DIR, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });

      const { Body } = await s3.send(new GetObjectCommand({ Bucket: CF_R2_BUCKET, Key: key }));
      const buf = await streamToBuffer(Body);
      fs.writeFileSync(dest, buf);
      total++;
      process.stdout.write(`\r  Downloaded ${total} files...`);
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log('');
  log(`Downloaded ${total} files from R2 ✓`);

  // ── 3. Package into .tar.gz ────────────────────────────────────────────────
  const date     = new Date().toISOString().slice(0, 10);
  const outFile  = path.join(__dirname, `boxes-backup-${date}.tar.gz`);
  log(`Packaging backup → ${path.basename(outFile)}`);
  execSync(`tar czf "${outFile}" --exclude="._*" -C "${BACKUP_DIR}" .`);

  // Clean up staging
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });

  const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  log(`Done! Backup saved: ${path.basename(outFile)} (${sizeMB} MB)`);
  console.log('');
  console.log('To restore to Docker:');
  console.log(`  docker volume create boxes_boxes-data`);
  console.log(`  docker run --rm -v boxes_boxes-data:/data -v "$(pwd)":/backup alpine tar xzf /backup/${path.basename(outFile)} -C /data`);
  console.log(`  docker compose up -d`);
}

main().catch(e => { console.error(e); process.exit(1); });
