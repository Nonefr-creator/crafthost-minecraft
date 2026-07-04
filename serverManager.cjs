const { spawn } = require("child_process");
const ngrok = require("ngrok");
const fs = require("fs");
const path = require("path");
const dns = require("./dns.cjs");

const SERVERS_FILE = path.join(__dirname, "servers.json");
const PLUGINS_ROOT = path.join(__dirname, "plugins");

let logs = [];
let servers = {};
let processes = {};
let intentionallyStopped = {};
let currentRamG = {};

const BASE_PORT = 25565;

function loadServers() {
  try {
    const raw = fs.readFileSync(SERVERS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    servers = parsed.servers || {};
    servers._nextPort = parsed.nextPort || BASE_PORT;
  } catch (e) {
    servers = {};
    servers._nextPort = BASE_PORT;
  }
}

function saveServers() {
  try {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify({ servers: servers, nextPort: servers._nextPort }, null, 2), "utf8");
  } catch (e) {
    // ignore
  }
}

function generateSubdomain(userId) {
  if (userId === 'public') return 'play.crafthost.dev';
  return `${userId}.crafthost.dev`;
}

function allocatePort() {
  if (!servers._nextPort) servers._nextPort = BASE_PORT;
  const port = servers._nextPort;
  servers._nextPort += 1;
  return port;
}

function ensureInstanceDir(ownerId) {
  const instancesRoot = path.join(__dirname, 'instances');
  if (!fs.existsSync(instancesRoot)) fs.mkdirSync(instancesRoot, { recursive: true });
  const instDir = path.join(instancesRoot, ownerId);
  if (!fs.existsSync(instDir)) {
    const src = path.join(__dirname, 'server');
    fs.cpSync(src, instDir, { recursive: true });
  }
  return instDir;
}

function ensurePlugins(instDir, plugins = []) {
  if (!Array.isArray(plugins) || plugins.length === 0) return;
  const pluginDir = path.join(instDir, 'plugins');
  if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });
  plugins.forEach((pluginName) => {
    const sourceJar = path.join(PLUGINS_ROOT, `${pluginName}.jar`);
    if (fs.existsSync(sourceJar)) {
      try {
        fs.copyFileSync(sourceJar, path.join(pluginDir, `${pluginName}.jar`));
      } catch (e) {
        // ignore
      }
    }
  });
}

function writeServerPort(instDir, port) {
  const propFile = path.join(instDir, 'server.properties');
  try {
    let txt = fs.existsSync(propFile) ? fs.readFileSync(propFile, 'utf8') : '';
    if (/^server-port=/m.test(txt)) {
      txt = txt.replace(/^server-port=.*$/m, `server-port=${port}`);
    } else {
      txt += `\nserver-port=${port}`;
    }
    fs.writeFileSync(propFile, txt, 'utf8');
  } catch (e) {
    // ignore
  }
}

function writeServerProperties(instDir, props = {}) {
  const propFile = path.join(instDir, 'server.properties');
  try {
    let txt = fs.existsSync(propFile) ? fs.readFileSync(propFile, 'utf8') : '';
    Object.entries(props).forEach(([key, value]) => {
      const line = `${key}=${value}`;
      if (new RegExp(`^${key}=`, 'm').test(txt)) {
        txt = txt.replace(new RegExp(`^${key}=.*$`, 'm'), line);
      } else {
        txt += `\n${line}`;
      }
    });
    fs.writeFileSync(propFile, txt, 'utf8');
  } catch (e) {
    // ignore
  }
}

async function ensureInstanceRunning(ownerId, ramG = 2, onlineMode = true, plugins = []) {
  if (processes[ownerId]) return;

  intentionallyStopped[ownerId] = false;
  currentRamG[ownerId] = ramG || 2;

  loadServers();
  const inst = servers[ownerId] || {};
  let port = inst.port;
  if (!port) port = allocatePort();

  let ngrokUrl = null;

  const instDir = ensureInstanceDir(ownerId);
  writeServerPort(instDir, port);
  writeServerProperties(instDir, { 'online-mode': onlineMode ? 'true' : 'false' });
  ensurePlugins(instDir, plugins);

  const child = spawn('java', [`-Xmx${currentRamG[ownerId]}G`, '-jar', 'server.jar', 'nogui'], { cwd: instDir });
  processes[ownerId] = child;

  try {
    const ngrokToken = process.env.NGROK_AUTHTOKEN || process.env.NGROK_AUTHTOKEN?.trim();
    if (ngrokToken) {
      await ngrok.authtoken(ngrokToken);
      ngrokUrl = await ngrok.connect({ addr: port, proto: 'tcp' });
    } else {
      logs.push(`[${ownerId}] ngrok not configured; running local server only`);
    }
  } catch (e) {
    logs.push(`[${ownerId}] ngrok failed: ${e.message}`);
  }

  child.stdout.on('data', (d) => {
    const s = `[${ownerId}] ${d.toString()}`;
    logs.push(s);
    if (logs.length > 2000) logs.shift();
  });
  child.stderr.on('data', (d) => {
    const s = `[${ownerId}] ${d.toString()}`;
    logs.push(s);
    if (logs.length > 2000) logs.shift();
  });

  child.on('exit', (code, signal) => {
    logs.push(`[${ownerId}] exited code=${code} signal=${signal}`);
    delete processes[ownerId];
    if (!intentionallyStopped[ownerId]) {
      setTimeout(() => ensureInstanceRunning(ownerId, currentRamG[ownerId], servers[ownerId] && servers[ownerId].onlineMode !== false, servers[ownerId] && servers[ownerId].plugins).catch(() => {}), 5000);
    }
  });

  const url = ngrokUrl || null;

  servers[ownerId] = servers[ownerId] || {};
  servers[ownerId].domain = generateSubdomain(ownerId);
  servers[ownerId].url = url;
  servers[ownerId].port = port;
  servers[ownerId].onlineMode = onlineMode;
  servers[ownerId].plugins = plugins;
  if (url) {
    try {
      const cleaned = String(url).replace(/^tcp:\/\//, '');
      const parts = cleaned.split(':');
      servers[ownerId].host = parts[0];
      servers[ownerId].tunnelPort = parts[1] ? Number(parts[1]) : port;
    } catch (e) {}
  } else {
    servers[ownerId].host = 'localhost';
    servers[ownerId].tunnelPort = port;
  }
  servers[ownerId].startedAt = Date.now();
  servers[ownerId].ramG = currentRamG[ownerId];
  saveServers();

  if (url) {
    try {
      const cleaned = url.replace(/^tcp:\/\//, '');
      const [host, portStr] = cleaned.split(':');
      if (host && portStr) {
        dns.setSrvRecord(servers[ownerId].domain, host, Number(portStr)).catch(() => {});
      }
    } catch (e) {}
  }
}

async function startServer(options) {
  const ownerId = (options && (options.ownerId || options.userId)) || 'guest';
  const ramG = (options && options.ram) ? Number(options.ram) : 2;
  const sharedWith = (options && options.sharedWith) || [];
  const plugins = (options && options.plugins) || [];
  const onlineMode = (options && typeof options.onlineMode === 'boolean') ? options.onlineMode : true;
  const name = (options && options.name) ? options.name : `${ownerId}'s Server`;
  const software = (options && options.software) ? options.software : 'Paper';
  const version = (options && options.version) ? options.version : '1.21.8';

  loadServers();
  if (!servers[ownerId]) servers[ownerId] = {};

  await ensureInstanceRunning(ownerId, ramG, onlineMode, plugins);

  servers[ownerId].sharedWith = sharedWith;
  servers[ownerId].onlineMode = onlineMode;
  servers[ownerId].plugins = plugins;
  servers[ownerId].name = name;
  servers[ownerId].software = software;
  servers[ownerId].version = version;
  saveServers();

  return {
    ok: true,
    domain: servers[ownerId].domain,
    url: servers[ownerId].url,
    connect: servers[ownerId].url ? servers[ownerId].domain : `localhost:${servers[ownerId].port}`,
    onlineMode: servers[ownerId].onlineMode,
    plugins: servers[ownerId].plugins,
    name,
    software,
    version
  };
}

function setOnlineMode(ownerId, enabled = false) {
  loadServers();
  if (!ownerId) return { ok: false, error: 'ownerId required' };
  if (!servers[ownerId]) servers[ownerId] = {};
  const instDir = path.join(__dirname, 'instances', ownerId);
  if (!fs.existsSync(instDir)) return { ok: false, error: 'instance not found' };
  writeServerProperties(instDir, { 'online-mode': enabled ? 'true' : 'false' });
  servers[ownerId].onlineMode = enabled;
  saveServers();

  if (processes[ownerId]) {
    intentionallyStopped[ownerId] = true;
    try { processes[ownerId].kill(); } catch (e) {}
    delete processes[ownerId];
    try { ngrok.disconnect(servers[ownerId] && servers[ownerId].url); } catch (e) {}
    if (servers[ownerId]) delete servers[ownerId].url;
    saveServers();
    ensureInstanceRunning(ownerId, servers[ownerId].ramG || 2, enabled, servers[ownerId].plugins).catch(() => {});
  }

  return { ok: true, onlineMode: enabled };
}

async function stopServer({ ownerId = null, userRequested = true } = {}) {
  if (ownerId) {
    intentionallyStopped[ownerId] = Boolean(userRequested);
    const p = processes[ownerId];
    if (p) {
      try { p.kill(); } catch (e) {}
      delete processes[ownerId];
    }
    try { await ngrok.disconnect(servers[ownerId] && servers[ownerId].url); } catch (e) {}
    if (servers[ownerId]) {
      try { dns.removeSrvRecord(servers[ownerId].domain).catch(() => {}); } catch (e) {}
      delete servers[ownerId].url;
    }
    saveServers();
    return { ok: true };
  }

  Object.keys(processes).forEach((id) => {
    try { processes[id].kill(); } catch (e) {}
    delete processes[id];
    intentionallyStopped[id] = true;
  });
  try { await ngrok.kill(); } catch (e) {}
  Object.keys(servers).forEach((k) => { if (servers[k]) delete servers[k].url; });
  saveServers();
  return { ok: true };
}

function getServer(userId) {
  loadServers();
  return servers[userId] || null;
}

function getAllServers() {
  loadServers();
  return Object.entries(servers)
    .filter(([key]) => key !== '_nextPort')
    .map(([key, value]) => ({ ownerId: key, ...value }));
}

function getStatus() {
  const rc = Object.keys(processes).length;
  return { running: rc > 0, runningCount: rc, instances: Object.keys(servers).length };
}

function getLogs() {
  return logs.slice(-200);
}

function backupInstance(ownerId) {
  loadServers();
  const instDir = path.join(__dirname, 'instances', ownerId);
  if (!fs.existsSync(instDir)) return { ok: false, error: 'instance not found' };

  const backupsRoot = path.join(__dirname, 'backups', ownerId);
  if (!fs.existsSync(backupsRoot)) fs.mkdirSync(backupsRoot, { recursive: true });
  const ts = Date.now();
  const dest = path.join(backupsRoot, String(ts));
  try {
    fs.cpSync(instDir, dest, { recursive: true });
  } catch (e) {
    return { ok: false, error: e.message };
  }

  return { ok: true, path: dest };
}

loadServers();

module.exports = {
  startServer,
  stopServer,
  setOnlineMode,
  getServer,
  getAllServers,
  getLogs,
  getStatus,
  backupInstance
};
