require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { spawn } = require('child_process');
const serverManager = require("./serverManager.cjs");
const auth = require("./auth.cjs");
const state = require("./state.js"); 
const path = require('path');
const fs = require('fs');
const os = require('os');

// 🔥 İNATÇI HATAYI BİTİREN SATIR: Kimlik doğrulama motorunu sisteme tanıttık!
const { authenticate } = auth;

// 🚀 SIFIR TERMİNAL: Kullanıcının ruhu bile duymadan masaüstüne otomatik başlatıcı oluşturan fonksiyon
function autoCreateDesktopShortcut() {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const batPath = path.join(desktopPath, 'CraftHost-Hizli-Baslat.bat');
    
    if (fs.existsSync(batPath)) return;

    const rootPath = path.join(__dirname, '..');

    const content = `@echo off
title CraftHost Otomatik Baslatici
echo ==========================================
echo 🚀 CraftHost Sistemleri Atesleniyor...
echo ==========================================

echo ⚙️ Arka plan API sunucusu aciliyor...
start "CraftHost Backend API" cmd /k "cd /d ${__dirname} && node api.cjs"

timeout /t 3 /nobreak >nul

echo 🖥️ Ön yüz arayüzü canlandiriliyor...
start "CraftHost Ön Yüz" cmd /k "cd /d ${rootPath} && npm run dev"

echo 🎉 Tüm sistemler basariyla tetiklendi! Bu pencereyi kapatabilirsiniz.
timeout /t 2 >nul
exit
`;

    fs.writeFileSync(batPath, content, 'utf8');
    console.log('✨ [Otomasyon] Masaüstü hızlı başlatıcı kısayolu otomatik oluşturuldu!');
  } catch (e) {
    console.warn('⚠️ [Otomasyon] Masaüstü kısayolu oluşturulamadı:', e.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());

app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const CONFIG_FILE = path.join(__dirname, 'config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}'); } catch (e) { return {}; }
}

function writeConfig(obj) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf8'); return true; } catch (e) { return false; }
}

app.post('/config', authenticate, async (req, res) => {
  const body = req.body || {};
  const cfg = readConfig();

  if (body.CLOUDFLARE_TOKEN !== undefined) cfg.CLOUDFLARE_TOKEN = body.CLOUDFLARE_TOKEN;
  if (body.CLOUDFLARE_ZONE !== undefined) cfg.CLOUDFLARE_ZONE = body.CLOUDFLARE_ZONE;
  if (body.RECAPTCHA_SECRET !== undefined) cfg.RECAPTCHA_SECRET = body.RECAPTCHA_SECRET;

  const ok = writeConfig(cfg);
  if (ok) {
    if (cfg.CLOUDFLARE_TOKEN) process.env.CLOUDFLARE_TOKEN = cfg.CLOUDFLARE_TOKEN;
    if (cfg.CLOUDFLARE_ZONE) process.env.CLOUDFLARE_ZONE = cfg.CLOUDFLARE_ZONE;
    return res.json({ ok: true, config: cfg });
  }
  res.json({ ok: false });
});

app.get('/config', authenticate, (req, res) => {
  res.json({ ok: true, config: readConfig() });
});

app.post("/start", authenticate, async (req, res) => {
  try {
    const ownerId = req.user.username || req.user.id || 'guest';
    const ram = req.body.ram || 2;
    const sharedWith = req.body.sharedWith || [];
    const plugins = req.body.plugins || [];
    const onlineMode = typeof req.body.onlineMode === 'boolean' ? req.body.onlineMode : false;
    
    const subdomain = req.body.subdomain || ownerId; 
    const serverName = req.body.name || `${ownerId}'s Server`;
    const version = req.body.version || '26.1.2';

    const result = await serverManager.startServer({ 
      ownerId, ram, sharedWith, plugins, onlineMode, name: serverName, software: 'Paper', version, subdomain 
    });
    
    state.setRunning(ownerId, true);

    const server = serverManager.getServer(ownerId) || {};
    res.json(Object.assign(result, { host: server.host || null, port: server.tunnelPort || server.port || null, state: state.getState(ownerId) }));
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/quick', async (req, res) => {
  try {
    const ownerId = 'public';
    const ram = req.body?.ram || 2;
    
    const result = await serverManager.startServer({ 
      ownerId, ram, sharedWith: [], onlineMode: false, name: 'Genel Sunucu', software: 'Paper', version: '26.1.2', subdomain: 'play' 
    });
    
    state.setRunning(ownerId, true);

    const server = serverManager.getServer(ownerId) || {};
    return res.json(Object.assign(result, { host: server.host || null, port: server.tunnelPort || server.port || null, domain: server.domain, state: state.getState(ownerId) }));
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.post("/stop", authenticate, async (req, res) => {
  try {
    const ownerId = req.user.username || req.user.id || 'guest';
    await serverManager.stopServer({ ownerId, userRequested: true });
    
    state.setRunning(ownerId, false);

    res.json({ ok: true, state: state.getState(ownerId) });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/server/online-mode', authenticate, (req, res) => {
  try {
    const owner = req.body.ownerId || req.user.username || req.user.id || 'guest';
    const enabled = req.body.enabled === true;
    const result = serverManager.setOnlineMode(owner, enabled);
    return res.json(result);
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.post('/register', async (req, res) => {
  const { username, password, email, tosAccepted, captchaToken } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'username & password required' });
  if (!tosAccepted) return res.json({ ok: false, error: 'You must accept Terms of Service' });

  try {
    const cfg = readConfig();
    if (cfg.RECAPTCHA_SECRET) {
      if (!captchaToken) return res.json({ ok: false, error: 'Captcha required' });
      const https = require('https');
      const postData = `secret=${encodeURIComponent(cfg.RECAPTCHA_SECRET)}&response=${encodeURIComponent(captchaToken)}`;
      const options = {
        hostname: '://google.com',
        path: '/recaptcha/api/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      const verification = await new Promise((resolve) => {
        const req2 = https.request(options, (res2) => {
          let data = '';
          res2.on('data', (c) => data += c);
          res2.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { resolve({ success: false }); }
          });
        });
        req2.on('error', () => resolve({ success: false }));
        req2.write(postData);
        req2.end();
      });
      if (!verification || !verification.success) return res.json({ ok: false, error: 'Captcha verification failed' });
    }

    const u = auth.register(username, password, { email, tosAccepted });
    
    await serverManager.startServer({ ownerId: username, ram: 2, onlineMode: false, name: `${username}'s Server`, software: 'Paper', version: '26.1.2', subdomain: username });
    state.setRunning(username, true);

    const server = serverManager.getServer(username) || {};
    const loginResult = auth.login(username, password);
    res.json({ ok: true, token: loginResult.token, user: { id: u.id, username: u.username, apiKey: u.apiKey }, apiKey: u.apiKey, server, state: state.getState(username) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'username & password required' });
  try {
    const r = auth.login(username, password);
    
    const serverResult = await serverManager.startServer({ ownerId: username, ram: 2, onlineMode: false, name: `${username}'s Server`, software: 'Paper', version: '26.1.2', subdomain: username });
    state.setRunning(username, true);

    res.json({ ok: true, token: r.token, user: r.user, apiKey: r.user.apiKey, server: serverResult, state: state.getState(username) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/share', authenticate, async (req, res) => {
  const owner = req.user.username;
  const { target, role } = req.body || {};
  if (!target) return res.json({ ok: false, error: 'target required' });
  try {
    const s = serverManager.getServer(owner) || {};
    s.sharedWith = s.sharedWith || [];
    if (!s.sharedWith.includes(target)) s.sharedWith.push(target);
    if (!s.roles) s.roles = {};
    s.roles[target] = role || 'admin';
    await serverManager.startServer({ ownerId: owner, ram: s.ramG || 2, sharedWith: s.sharedWith, onlineMode: s.onlineMode, plugins: s.plugins, subdomain: owner });
    res.json({ ok: true, roles: s.roles });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/status", (req, res) => {
  res.json(serverManager.getStatus());
});

app.get("/server", (req, res) => {
  const payload = auth.getPayload ? auth.getPayload(req) : null;
  const userId = (payload && (payload.username || payload.id)) || req.query.userId || "guest";
  const s = serverManager.getServer(userId);
  res.json({ server: s, host: s ? s.host : null, port: s ? s.tunnelPort : null, state: state.getState(userId) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CraftHost API is running on port ${PORT}`);
  autoCreateDesktopShortcut();
});
