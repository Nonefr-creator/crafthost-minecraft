require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { spawn } = require('child_process');
const serverManager = require("./serverManager.cjs");
const auth = require("./auth.cjs");
const path = require('path');

function authenticate(req, res, next) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const token = h.slice(7);
  const payload = auth.verify(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Invalid token' });
  req.user = payload;
  next();
}

function getPayload(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return auth.verify(h.slice(7));
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());

app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Serve frontend build if present
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const CONFIG_FILE = path.join(__dirname, 'config.json');

function readConfig() {
  try { return JSON.parse(require('fs').readFileSync(CONFIG_FILE, 'utf8') || '{}'); } catch (e) { return {}; }
}

function writeConfig(obj) {
  try { require('fs').writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf8'); return true; } catch (e) { return false; }
}

app.post('/config', authenticate, async (req, res) => {
  // body: { CLOUDFLARE_TOKEN, CLOUDFLARE_ZONE, NGROK_AUTHTOKEN }
  const body = req.body || {};
  const cfg = readConfig();
  ['CLOUDFLARE_TOKEN','CLOUDFLARE_ZONE','NGROK_AUTHTOKEN'].forEach(k => { if (body[k]) cfg[k] = body[k]; });
  const ok = writeConfig(cfg);
  if (ok) {
    // update process.env for immediate use
    if (cfg.NGROK_AUTHTOKEN) process.env.NGROK_AUTHTOKEN = cfg.NGROK_AUTHTOKEN;
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
    const result = await serverManager.startServer({ ownerId, ram, sharedWith, plugins, onlineMode, name: req.body.name, software: req.body.software, version: req.body.version });
    const server = serverManager.getServer(ownerId) || {};
    res.json(Object.assign(result, { host: server.host || null, port: server.tunnelPort || server.port || null }));
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/quick', async (req, res) => {
  try {
    const ownerId = 'public';
    const ram = req.body?.ram || 2;
    const result = await serverManager.startServer({ ownerId, ram, sharedWith: [], onlineMode: false, name: 'Genel Sunucu', software: 'Paper', version: '1.21.8' });
    const server = serverManager.getServer(ownerId) || {};
    return res.json(Object.assign(result, { host: server.host || null, port: server.tunnelPort || server.port || null, domain: server.domain }));
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.post("/stop", authenticate, async (req, res) => {
  try {
    await serverManager.stopServer({ userRequested: true });
    res.json({ ok: true });
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
        hostname: 'www.google.com',
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
    await serverManager.startServer({ ownerId: username, ram: 2, onlineMode: false, name: `${username}'s Server`, software: 'Paper', version: '1.21.8' });
    const server = serverManager.getServer(username) || {};
    const loginResult = auth.login(username, password);
    res.json({ ok: true, token: loginResult.token, user: { id: u.id, username: u.username, apiKey: u.apiKey }, apiKey: u.apiKey, server });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'username & password required' });
  try {
    const r = auth.login(username, password);
    const serverResult = await serverManager.startServer({ ownerId: username, ram: 2, onlineMode: false, name: `${username}'s Server`, software: 'Paper', version: '1.21.8' });
    res.json({ ok: true, token: r.token, user: r.user, apiKey: r.user.apiKey, server: serverResult });
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
    await serverManager.startServer({ ownerId: owner, ram: s.ramG || 2, sharedWith: s.sharedWith, onlineMode: s.onlineMode, plugins: s.plugins });
    res.json({ ok: true, roles: s.roles });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/status", (req, res) => {
  res.json(serverManager.getStatus());
});

app.get("/server", (req, res) => {
  const payload = getPayload(req);
  const userId = (payload && (payload.username || payload.id)) || req.query.userId || "guest";
  const s = serverManager.getServer(userId);
  res.json({ server: s, host: s && s.host, port: s && (s.tunnelPort || s.port) });
});

app.get('/join', async (req, res) => {
  try {
    const ownerId = 'public';
    let server = serverManager.getServer(ownerId);
    if (!server || !server.url) {
      await serverManager.startServer({ ownerId, ram: 2, sharedWith: [], onlineMode: false });
      server = serverManager.getServer(ownerId);
    }
    return res.json({
      ok: true,
      server,
      connect: server.url ? server.domain : `localhost:${server.port}`,
      publicTunnel: Boolean(server.url)
    });
  } catch (err) {
    return res.json({ ok: true, server: serverManager.getServer('public') || null, connect: serverManager.getServer('public') ? `localhost:${serverManager.getServer('public').port}` : null, publicTunnel: false });
  }
});

app.get("/logs", (req, res) => {
  res.json({ logs: serverManager.getLogs() });
});

app.get('/public', (req, res) => {
  const list = serverManager.getAllServers().map((s) => ({
    owner: s.ownerId,
    name: s.name,
    domain: s.domain,
    software: s.software,
    version: s.version,
    host: s.host,
    port: s.tunnelPort || s.port,
    onlineMode: s.onlineMode
  }));
  res.json({ ok: true, servers: list });
});

app.get('/servers', (req, res) => {
  const list = serverManager.getAllServers().map((s) => ({
    owner: s.ownerId,
    name: s.name,
    domain: s.domain,
    software: s.software,
    version: s.version,
    host: s.host,
    port: s.tunnelPort || s.port,
    onlineMode: s.onlineMode
  }));
  res.json({ ok: true, servers: list });
});

app.post('/shortcut', authenticate, async (req, res) => {
  const shortcutScript = path.join(__dirname, '..', 'scripts', 'create-shortcut.js');
  const { url = 'http://localhost:3001', name = 'CraftHost', startup = false } = req.body || {};
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn('node', [shortcutScript, url, name, ...(startup ? ['--startup'] : [])], { shell: true });
      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Shortcut script exited ${code}`));
      });
      proc.on('error', reject);
    });
    return res.json({ ok: true, message: 'Shortcut created' });
  } catch (e) {
    return res.json({ ok: false, error: e.message || 'Shortcut creation failed' });
  }
});

const initialConfig = readConfig();
if (initialConfig.NGROK_AUTHTOKEN) {
  process.env.NGROK_AUTHTOKEN = initialConfig.NGROK_AUTHTOKEN;
}
if (initialConfig.CLOUDFLARE_TOKEN) {
  process.env.CLOUDFLARE_TOKEN = initialConfig.CLOUDFLARE_TOKEN;
}
if (initialConfig.CLOUDFLARE_ZONE) {
  process.env.CLOUDFLARE_ZONE = initialConfig.CLOUDFLARE_ZONE;
}

app.listen(3001, () => {
  console.log("CraftHost API running on http://localhost:3001");
  serverManager.startServer({ ownerId: 'public', ram: 2, sharedWith: [], onlineMode: false })
    .then(() => console.log('Public server initialized'))
    .catch((err) => console.warn('Public server failed to initialize', err.message || err));
});

app.post('/backup', authenticate, async (req, res) => {
  try {
    const owner = req.user.username;
    const r = serverManager.backupInstance(owner);
    res.json(r);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});