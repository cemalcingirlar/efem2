/* =========================================
   Yerel geliştirme sunucusu
   =========================================
   Statik dosyaları servis eder ve /api/* isteklerini Vercel Functions
   ile aynı imzayı (req.query, req.body, res.status().send()) taklit ederek
   api/ klasöründeki handler'lara yönlendirir.

   Çalıştırma:  node dev-server.js
   Ortam:       .env.local varsa yüklenir (sırlar git'e gitmez).            */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

/* ─── .env.local ─── */
loadEnvFile(path.join(__dirname, '.env.local'));

/* ─── vercel.json başlıkları ───
   Güvenlik başlıkları (özellikle Content-Security-Policy) yerelde de
   uygulanır; aksi hâlde ödeme sayfasının sıkı CSP'si ancak canlıda ortaya
   çıkar ve "yerelde çalışıyordu" durumuna düşülür.
   Vercel'in kural sırası: aynı başlık birden çok kuralda varsa SONUNCU kazanır. */
const vercelHeaderRules = loadVercelHeaders(path.join(__dirname, 'vercel.json'));

function loadVercelHeaders(file) {
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (config.headers || []).map(rule => ({
      // "/odeme-guvenli(.html)?" gibi Vercel kaynak desenlerini regex'e çevir
      test: new RegExp('^' + rule.source.replace(/\/$/, '') + '$'),
      headers: rule.headers || []
    }));
  } catch {
    return [];
  }
}

function applyVercelHeaders(res, pathname) {
  for (const rule of vercelHeaderRules) {
    if (!rule.test.test(pathname)) continue;
    for (const h of rule.headers) res.setHeader(h.key, h.value);
  }
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (value) process.env[match[1]] = value;
  }
  console.log('.env.local yüklendi');
}

/* ─── /api yönlendirme ─── */
/* api/ altındaki TÜM modüller her istekte tazelenir.
   Yalnız handler dosyasının cache'i düşürülseydi, `api/_lib/*` içindeki
   değişiklikler sunucu yeniden başlatılana kadar görünmez olurdu — ve
   eski kodla test edip "hata var" sanmaya yol açardı. */
const API_DIR = path.join(__dirname, 'api');

function clearApiCache() {
  for (const id of Object.keys(require.cache)) {
    if (id.startsWith(API_DIR)) delete require.cache[id];
  }
}

function resolveApiHandler(pathname) {
  const rel = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  if (!rel || rel.includes('..')) return null;
  const file = path.join(__dirname, 'api', `${rel}.js`);
  if (!fs.existsSync(file)) return null;
  clearApiCache();
  return require(file);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function decorateResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (payload) => {
    if (payload === undefined || payload === null) return res.end();
    res.end(typeof payload === 'string' || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload));
    return res;
  };
  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify(payload));
  };
  return res;
}

async function handleApi(req, res, url) {
  const handler = resolveApiHandler(url.pathname);
  if (typeof handler !== 'function') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, code: 'not_found', message: 'API adresi bulunamadı.' }));
    return;
  }

  req.query = Object.fromEntries(url.searchParams);

  const raw = await readBody(req);
  const type = String(req.headers['content-type'] || '');
  if (raw.length) {
    const text = raw.toString('utf8');
    if (type.includes('application/json')) {
      try { req.body = JSON.parse(text); } catch { req.body = {}; }
    } else if (type.includes('application/x-www-form-urlencoded')) {
      req.body = Object.fromEntries(new URLSearchParams(text));
    } else {
      req.body = text;
    }
  }

  decorateResponse(res);

  try {
    await handler(req, res);
  } catch (err) {
    console.error('[dev-server] handler hatası:', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, code: 'internal_error', message: 'Sunucu hatası.' }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url);
    return;
  }

  let reqPath = decodeURI(url.pathname);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(__dirname, reqPath);

  // Doğrudan yoksa .html eklemeyi dene (cleanUrls davranışı)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Sayfa Bulunamadı');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('500 Sunucu Hatası');
      return;
    }
    applyVercelHeaders(res, reqPath);
    res.setHeader('Content-Type', contentType);
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Local sunucu başlatıldı: http://localhost:${PORT}`);
});
