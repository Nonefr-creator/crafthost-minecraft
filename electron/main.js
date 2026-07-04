const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

let backendProcess;

function getBackendScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'api.cjs');
  }
  return path.join(__dirname, '..', 'backend', 'api.cjs');
}

function getAppUrl() {
  return 'http://localhost:3001';
}

function checkJava() {
  return new Promise((resolve) => {
    const javaCmd = process.platform === 'win32' ? 'java.exe' : 'java';
    execFile(javaCmd, ['-version'], (error) => {
      resolve(!error);
    });
  });
}

async function ensureJava() {
  const hasJava = await checkJava();
  if (hasJava) return true;

  const result = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Java İndir', 'Devam Et', 'Çıkış'],
    title: 'Java Bulunamadı',
    message: 'Minecraft sunucusu için Java gereklidir. Java yüklü değilse uygulama çalışmayabilir.',
    detail: 'Java yüklü değil. Java indirmek için "Java İndir" seçeneğini kullanabilirsiniz.',
    cancelId: 2,
    defaultId: 0,
  });

  if (result.response === 0) {
    shell.openExternal('https://adoptium.net/?variant=openjdk17');
    return false;
  }
  if (result.response === 2) {
    app.quit();
    return false;
  }
  return true;
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const scriptPath = getBackendScriptPath();
    const runner = process.execPath;

    backendProcess = spawn(runner, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    backendProcess.stdout.on('data', (chunk) => {
      console.log(`[backend] ${chunk.toString().trim()}`);
    });
    backendProcess.stderr.on('data', (chunk) => {
      console.error(`[backend] ${chunk.toString().trim()}`);
    });

    backendProcess.on('error', (error) => reject(error));
    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend exited code=${code} signal=${signal}`);
      backendProcess = null;
    });

    waitOn({ resources: [getAppUrl()], timeout: 20000 }, (err) => {
      if (err) {
        reject(new Error('Backend did not start in time'));
      } else {
        resolve();
      }
    });
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  win.loadURL(getAppUrl());
  win.once('ready-to-show', () => win.show());
}

app.on('ready', async () => {
  const javaOk = await ensureJava();
  if (!javaOk) return;

  try {
    await startBackend();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox('Başlatma Hatası', error.message || 'Sunucu başlatılamadı.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
