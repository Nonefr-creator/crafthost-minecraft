const { spawn } = require('child_process');
const http = require('http');
const open = require('open');
const path = require('path');

async function run(cmd, args, opts = {}){
  return new Promise((resolve, reject)=>{
    const p = spawn(cmd, args, Object.assign({ stdio: 'inherit', shell: true }, opts));
    p.on('exit', (code)=> code === 0 ? resolve() : reject(new Error('Exit '+code)));
    p.on('error', reject);
  });
}

(async ()=>{
  try{
    console.log('Building frontend...');
    await run('npm', ['run', 'build']);

    console.log('Starting backend...');
    const backend = spawn('node', ['backend/api.cjs'], { detached: false, stdio: 'inherit', shell: true });

    // wait for backend to be ready
    const url = 'http://localhost:3001/status';
    let ok = false;
    for (let i=0;i<20;i++){
      try{
        await new Promise((resolve, reject)=>{
          const req = http.get(url, (res)=>{
            res.resume();
            if (res.statusCode && res.statusCode >=200 && res.statusCode < 500){
              resolve();
            } else reject(new Error('bad status'));
          });
          req.on('error', reject);
          req.setTimeout(2000, ()=>{ req.abort(); reject(new Error('timeout')); });
        });
        ok = true; break;
      }catch(e){}
      await new Promise(r=>setTimeout(r, 500));
    }

    if (ok){
      console.log('Backend ready — opening browser at http://localhost:3001');
      await open('http://localhost:3001');
    } else {
      console.log('Backend did not respond in time. Check backend logs.');
    }
  }catch(e){
    console.error('Start failed:', e.message);
    process.exit(1);
  }
})();
