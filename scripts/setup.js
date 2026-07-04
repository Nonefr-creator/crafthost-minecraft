const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

function question(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

function randSecret() {
  return [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
}

async function validateCloudflare(token, zone) {
  if (!token || !zone) return false;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function createShortcut() {
  return new Promise((resolve, reject) => {
    const setup = spawn('node', ['scripts/create-shortcut.js'], { stdio: 'inherit', shell: true });
    setup.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Shortcut creation failed')));
    setup.on('error', reject);
  });
}

async function main(){
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const ok = (await question('.env zaten var. Üzerine yazılsın mı? (evet/hayır) ')).toLowerCase();
    if (ok !== 'evet') { console.log('İptal.'); process.exit(0); }
  }

  const jwt = await question('JWT_SECRET (enter to auto-generate): ');
  const cfToken = await question('Cloudflare Token (opsiyonel): ');
  const cfZone = cfToken ? await question('Cloudflare Zone ID (opsiyonel): ') : '';
  const ngrokToken = process.env.NGROK_AUTHTOKEN || '';

  const secret = jwt || randSecret();

  let cfValid = false;
  if (cfToken && cfZone) {
    console.log('Cloudflare doğrulanıyor...');
    cfValid = await validateCloudflare(cfToken, cfZone);
    console.log('Cloudflare doğrulama:', cfValid ? 'başarılı' : 'başarısız');
  }

  const content = `JWT_SECRET=${secret}\nNGROK_AUTHTOKEN=${ngrokToken}\nCLOUDFLARE_TOKEN=${cfToken || ''}\nCLOUDFLARE_ZONE=${cfZone || ''}\n`;
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('.env dosyası oluşturuldu:', envPath);

  console.log('Masaüstü başlatıcısı oluşturuluyor...');
  try {
    await createShortcut();
    console.log('Masaüstü başlatıcısı oluşturuldu.');
  } catch (err) {
    console.warn('Başlatıcı oluşturulamadı:', err.message);
  }

  const startNow = (await question('Uygulamayı şimdi başlatmak ister misin? (evet/hayır) ')).toLowerCase();
  if (startNow === 'evet') {
    console.log('Uygulama başlatılıyor...');
    const p = spawn('npm', ['run', 'start:prod'], { stdio: 'inherit', shell: true });
    p.on('exit', (c) => process.exit(c));
  } else {
    console.log('Kurulum tamam. Masaüstünden başlatmak için kısayolu kullanabilirsiniz.');
    process.exit(0);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
