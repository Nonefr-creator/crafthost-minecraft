import { useState } from "react";

const API = "http://localhost:3001";

export default function CreateServer() {
  const [name, setName] = useState("CraftHost Sunucusu");
  const [software, setSoftware] = useState("Paper");
  const [version, setVersion] = useState("1.21.8");
  const [ram, setRam] = useState(4);
  const [onlineMode, setOnlineMode] = useState(false);
  const [plugins, setPlugins] = useState<string[]>(['AntiXray', 'NoCheatPlus']);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('ch_token');

  async function createServer() {
    if (!token) {
      setMessage('Önce oturum açın.');
      return;
    }

    setLoading(true);
    setMessage('Sunucu başlatılıyor...');

    try {
      const res = await fetch(`${API}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, software, version, ram, onlineMode, plugins, sharedWith: [] })
      });
      const json = await res.json();
      if (json.ok) {
        setMessage(`Sunucu başlatıldı: ${json.domain}`);
      } else {
        setMessage(`Hata: ${json.error || 'Sunucu oluşturulamadı'}`);
      }
    } catch (e) {
      setMessage('Ağ hatası.');
    }

    setLoading(false);
  }

  return (
    <main className="content">
      <header className="header">
        <div>
          <h2>Yeni Sunucu Oluştur</h2>
          <p>Profesyonel Minecraft sunucusunu hızlıca kur.</p>
        </div>
      </header>

      <section className="card" style={{ maxWidth: 680 }}>
        <div className="form">
          <label>Sunucu Adı</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="CraftHost Sunucusu" />

          <label>Yazılım</label>
          <select value={software} onChange={e => setSoftware(e.target.value)}>
            <option>Paper</option>
            <option>Purpur</option>
            <option>Folia</option>
            <option>Fabric</option>
            <option>Forge</option>
            <option>NeoForge</option>
          </select>

          <label>Sürüm</label>
          <select value={version} onChange={e => setVersion(e.target.value)}>
            <option>1.21.8</option>
            <option>1.21.7</option>
            <option>1.21.6</option>
            <option>1.20.6</option>
            <option>1.20.4</option>
            <option>1.19.4</option>
            <option>1.18.2</option>
            <option>1.16.5</option>
            <option>1.12.2</option>
            <option>1.8.8</option>
          </select>

          <label>RAM</label>
          <input type="range" min="1" max="16" value={ram} onChange={e => setRam(Number(e.target.value))} />
          <span>{ram} GB</span>

          <label>Online-mode</label>
          <select value={onlineMode ? 'true' : 'false'} onChange={e => setOnlineMode(e.target.value === 'true')}>
            <option value="false">false</option>
            <option value="true">true</option>
          </select>

          <label>Önerilen Eklentiler</label>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>
              <input type="checkbox" checked={plugins.includes('AntiXray')} onChange={e => {
                const next = e.target.checked ? [...plugins, 'AntiXray'] : plugins.filter(p => p !== 'AntiXray');
                setPlugins(next);
              }} /> AntiXray
            </label>
            <label>
              <input type="checkbox" checked={plugins.includes('NoCheatPlus')} onChange={e => {
                const next = e.target.checked ? [...plugins, 'NoCheatPlus'] : plugins.filter(p => p !== 'NoCheatPlus');
                setPlugins(next);
              }} /> NoCheatPlus
            </label>
            <label>
              <input type="checkbox" checked={plugins.includes('EssentialsX')} onChange={e => {
                const next = e.target.checked ? [...plugins, 'EssentialsX'] : plugins.filter(p => p !== 'EssentialsX');
                setPlugins(next);
              }} /> EssentialsX
            </label>
          </div>

          <button className="bigButton" onClick={createServer} disabled={loading}>
            {loading ? 'Başlatılıyor...' : 'Sunucuyu Oluştur'}
          </button>

          {message && <p style={{ marginTop: 16 }}>{message}</p>}
        </div>
      </section>
    </main>
  );
}
