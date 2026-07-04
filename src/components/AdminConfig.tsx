import { useState, useEffect } from 'react';

export default function AdminConfig(){
  const [cfg, setCfg] = useState<any>({});
  const [token, setToken] = useState(localStorage.getItem('ch_token') || '');
  const API = 'http://localhost:3001';

  useEffect(()=>{ fetchConfig(); }, []);

  async function fetchConfig(){
    try{
      const r = await fetch(`${API}/config`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.ok) setCfg(j.config || {});
    }catch(e){}
  }

  async function save(){
    try{
      const r = await fetch(`${API}/config`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(cfg) });
      const j = await r.json();
      if (j.ok) alert('Saved'); else alert('Save failed');
    }catch(e){ alert('Save failed'); }
  }

  async function setOnlineMode(enabled) {
    try {
      const ownerId = prompt('Owner username to apply online-mode toggle:', 'guest');
      if (!ownerId) return;
      const r = await fetch(`${API}/server/online-mode`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ownerId, enabled })
      });
      const j = await r.json();
      if (j.ok) {
        alert(`online-mode set to ${j.onlineMode} for ${ownerId}`);
      } else {
        alert('Failed: ' + (j.error || 'unknown'));
      }
    } catch (e) {
      alert('Failed to update online-mode');
    }
  }

  return (
    <div className="card">
      <h3>Site Config</h3>
      <div style={{ display: 'grid', gap:8 }}>
        <label>Admin Token (JWT)</label>
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="JWT token" />

        <label>Cloudflare Token</label>
        <input value={cfg.CLOUDFLARE_TOKEN||''} onChange={e=>setCfg({...cfg,CLOUDFLARE_TOKEN:e.target.value})} />

        <label>Cloudflare Zone</label>
        <input value={cfg.CLOUDFLARE_ZONE||''} onChange={e=>setCfg({...cfg,CLOUDFLARE_ZONE:e.target.value})} />

        <label>Ngrok Authtoken</label>
        <input value={cfg.NGROK_AUTHTOKEN||''} onChange={e=>setCfg({...cfg,NGROK_AUTHTOKEN:e.target.value})} />

        <label>reCAPTCHA Secret</label>
        <input value={cfg.RECAPTCHA_SECRET||''} onChange={e=>setCfg({...cfg,RECAPTCHA_SECRET:e.target.value})} />

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={save}>Save</button>
          <button onClick={fetchConfig}>Refresh</button>
        </div>

        <div style={{ display:'flex', gap:8, marginTop: 16 }}>
          <button onClick={() => setOnlineMode(true)}>Set online-mode=true</button>
          <button onClick={() => setOnlineMode(false)}>Set online-mode=false</button>
        </div>
      </div>
    </div>
  );
}
