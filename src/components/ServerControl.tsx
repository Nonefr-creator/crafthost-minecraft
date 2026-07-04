import { useEffect, useState } from "react";

export default function ServerControl() {
  const [status, setStatus] = useState<any>({ running: false, count: 0 });
  const [server, setServer] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('ch_token'));
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('ch_apiKey'));
  const [user, setUser] = useState<string | null>(localStorage.getItem('ch_user'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [captchaTokenInput, setCaptchaTokenInput] = useState('');
  const [ram, setRam] = useState(2);
  const [message, setMessage] = useState('');

  const API = "http://localhost:3001";

  async function fetchStatus() {
    try {
      const r = await fetch(`${API}/status`);
      const j = await r.json();
      setStatus(j);
    } catch (e) {}
  }

  async function fetchServer() {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const url = token ? `${API}/server` : `${API}/server?userId=guest`;
      const r = await fetch(url, { headers });
      const j = await r.json();
      setServer(j.server);
    } catch (e) {}
  }

  async function fetchLogs() {
    try {
      const r = await fetch(`${API}/logs`);
      const j = await r.json();
      setLogs(j.logs || []);
    } catch (e) {}
  }

  async function start() {
    setLoading(true);
    setMessage('Sunucu başlatılıyor...');
    try {
      const r = await fetch(`${API}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ram, sharedWith: [] })
      });
      const j = await r.json();
      if (j.ok) {
        setMessage('Sunucunuz hazır. Kontrol panelini yeniledim.');
      } else {
        setMessage(`Hata: ${j.error || 'Sunucu başlatılamadı.'}`);
      }
    } catch (e) {
      setMessage('Bağlantı hatası, lütfen tekrar deneyin.');
    }
    setLoading(false);
    await refreshAll();
  }

  async function stop() {
    setLoading(true);
    setMessage('Sunucu durduruluyor...');
    try {
      const r = await fetch(`${API}/stop`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      const j = await r.json();
      if (j.ok) {
        setMessage('Sunucu durduruldu.');
      } else {
        setMessage(`Hata: ${j.error || 'Durdurma başarısız.'}`);
      }
    } catch (e) {
      setMessage('İstek gönderilemedi.');
    }
    setLoading(false);
    await refreshAll();
  }

  async function doRegister() {
    setMessage('Kayıt işlemi sürüyor...');
    try {
      const r = await fetch(`${API}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, tosAccepted, captchaToken: captchaTokenInput })
      });
      const j = await r.json();
      if (j.ok && j.token) {
        setToken(j.token);
        setApiKey(j.apiKey || null);
        setUser(username);
        localStorage.setItem('ch_token', j.token);
        if (j.apiKey) localStorage.setItem('ch_apiKey', j.apiKey);
        localStorage.setItem('ch_user', username);
        setMessage('Kayıt başarılı! Sunucunuz hazırlanıyor...');
        await refreshAll();
      } else {
        setMessage(`Kayıt başarısız: ${j.error || 'Lütfen bilgileri kontrol edin.'}`);
      }
    } catch (e) {
      setMessage('Sunucuya bağlanılamadı.');
    }
  }

  async function doLogin() {
    setMessage('Giriş yapılıyor...');
    try {
      const r = await fetch(`${API}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
      });
      const j = await r.json();
      if (j.ok && j.token) {
        setToken(j.token);
        setApiKey(j.apiKey || null);
        setUser(username);
        localStorage.setItem('ch_token', j.token);
        if (j.apiKey) localStorage.setItem('ch_apiKey', j.apiKey);
        localStorage.setItem('ch_user', username);
        setMessage('Giriş başarılı! Sunucunu yönetmek için hazır.');
        await refreshAll();
      } else {
        setMessage(`Giriş başarısız: ${j.error || 'Bilgilerinizi kontrol edin.'}`);
      }
    } catch (e) {
      setMessage('Bağlantı hatası.');
    }
  }

  function logout() {
    setToken(null);
    setApiKey(null);
    setUser(null);
    localStorage.removeItem('ch_token');
    localStorage.removeItem('ch_apiKey');
    localStorage.removeItem('ch_user');
    setMessage('Çıkış yaptınız.');
    setServer(null);
  }

  async function refreshAll() {
    await Promise.all([fetchStatus(), fetchServer(), fetchLogs()]);
  }

  useEffect(() => {
    if (token && !user) {
      setUser(localStorage.getItem('ch_user'));
    }
    refreshAll();
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="card serverControl">
      <div className="sectionHeader">
        <div>
          <h2>Sunucu Kontrol</h2>
          <p>{user ? `Hoş geldin, ${user}. Hemen yönetim paneline göz at.` : 'Kayıt ol veya giriş yap. Sunucun arka planda otomatik açılacak.'}</p>
        </div>
        {user && <div className="pill">Hesap: {user}</div>}
      </div>

      <div className="serverControlGrid">
        <div className="loginGrid">
          {!token ? (
            <div className="loginBox">
              <input placeholder="Kullanıcı adı" value={username} onChange={e => setUsername(e.target.value)} />
              <input placeholder="Parola" type="password" value={password} onChange={e => setPassword(e.target.value)} />
              <label>
                <input type="checkbox" checked={tosAccepted} onChange={e => setTosAccepted(e.target.checked)} />
                <span> Kullanım şartlarını kabul ediyorum</span>
              </label>
              <input placeholder="reCAPTCHA token (isteğe bağlı)" value={captchaTokenInput} onChange={e => setCaptchaTokenInput(e.target.value)} />
              <div className="actions">
                <button className="button primary" onClick={doLogin}>Giriş Yap</button>
                <button className="button secondary" onClick={doRegister}>Kayıt Ol</button>
              </div>
            </div>
          ) : (
            <div className="controlPanel">
              <div className="statusBadge">{status.running ? 'Sunucu çalışıyor' : 'Sunucu duruyor'}</div>
              <div>
                <strong>RAM:</strong> {ram} GB
              </div>
              {apiKey && (
                <div className="apiKeyBox">
                  <strong>API Anahtarınız:</strong>
                  <code>{apiKey}</code>
                </div>
              )}
              <input type="range" min={1} max={16} value={ram} onChange={e => setRam(Number(e.target.value))} />
              <div className="actions">
                <button className="button primary" onClick={start} disabled={loading || status.running}>Başlat</button>
                <button className="button secondary" onClick={stop} disabled={loading || !status.running}>Durdur</button>
                <button className="button secondary" onClick={refreshAll}>Yenile</button>
              </div>
              <button className="button secondary" onClick={logout}>Çıkış Yap</button>
            </div>
          )}
        </div>

        <div>
          {message && <div className="messageBox">{message}</div>}
          {server && (
            <div className="serverInfo">
              <h3>{server.domain || 'Sunucu bilgisi yok'}</h3>
              <p><strong>Bağlan:</strong> {server.host ? `${server.host}:${server.tunnelPort || server.port}` : server.url}</p>
              <p><strong>Online mode:</strong> {server.onlineMode === false ? 'false' : 'true'}</p>
              <p><strong>Yazılım:</strong> {server.software}</p>
              <p><strong>Sürüm:</strong> {server.version}</p>
              <p><strong>Başlatma zamanı:</strong> {server.startedAt ? new Date(server.startedAt).toLocaleString() : 'Bekleniyor'}</p>
            </div>
          )}
          <div className="logs">
            <h4>Sunucu Logları</h4>
            <div className="logBox">
              {logs.length === 0 && <div>Log yok</div>}
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
