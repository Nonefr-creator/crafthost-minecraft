const fs = require('fs');
const path = require('path');
const os = require('os');

function writeUrlShortcut(name, url, targetFolder) {
  const content = `[InternetShortcut]\nURL=${url}\n`; 
  const filePath = path.join(targetFolder, `${name}.url`);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function main(){
  const url = process.argv[2] || 'http://localhost:3001';
  const name = process.argv[3] || 'CraftHost';
  const desktop = path.join(os.homedir(), 'Desktop');
  const startup = path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs\\Startup');
  try{
    const d = writeUrlShortcut(name, url, desktop);
    console.log('Desktop shortcut created:', d);
    if (process.argv.includes('--startup')){
      const s = writeUrlShortcut(name, url, startup);
      console.log('Startup shortcut created:', s);
    }
    // also create start.bat that runs npm run start:prod
    try {
      const bat = path.join(desktop, `${name}-start.bat`);
      const content = `cd /d "${process.cwd()}"\nnpm run start:prod\n`;
      fs.writeFileSync(bat, content, 'utf8');
      console.log('Desktop start batch created:', bat);
    } catch (e) {
      console.warn('Could not create start .bat:', e.message);
    }
  }catch(e){
    console.error('Failed to create shortcut:', e.message);
    process.exit(1);
  }
}

main();
