import { useEffect, useState } from "react";

const API = "http://localhost:3001";

function randomString(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length);
}

const recommendedPlugins = [
  "AntiXray",
  "NoCheatPlus",
  "EssentialsX",
  "Vault"
];

const supportedVersions = [
  "1.21.8",
  "1.21.7",
  "1.21.6",
  "1.20.6",
  "1.20.4",
  "1.19.4"
];

export default function SetupWizard() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('ch_token'));
  const [username, setUsername] = useState(localStorage.getItem('ch_user') || `craftguest-${randomString(4)}`);
  const [password, setPassword] = useState(localStorage.getItem('ch_pass') || randomString(10));
  const [serverName, setServerName] = useState("CraftHost Sunucusu");
  const [software, setSoftware] = useState("Paper");
  const [version, setVersion] = useState(supportedVersions[0]);
  const [ram, setRam] = useState(4);
  const [onlineMode, setOnlineMode] = useState(false);
  const [plugins, setPlugins] = useState<string[]>(["AntiXray", "NoCheatPlus"]);
  const [message, setMessage] = useState("Sunucu kurulumuna hazır. Tek tıkla devam et.");
  const [loading, setLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [publicServerInfo, setPublicServerInfo] = useState<any>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicMessage, setPublicMessage] = useState('Herkese açık sunucu bilgisi alınıyor...');
  const [shortcutCreated, setShortcutCreated] = useState(false);
  const [shortcutLoading, setShortcutLoading] = useState(false);
  const [shortcutMessage, setShortcutMessage] = useState('Masaüstü kısayolu için hazır.');
  const [ngrokToken, setNgrokToken] = useState(localStorage.getItem('ch_ngrokToken') || '');
  const [ngrokLoading, setNgrokLoading] = useState(false);
  const [ngrokMessage, setNgrokMessage] = useState('Public bağlantı için izin verilebilir.');

  async function ensureAccount() {
    const existingToken = localStorage.getItem('ch_token');
    if (existingToken) {
      setToken(existingToken);
      return existingToken;
    }

    const storedUser = localStorage.getItem('ch_user');
    const nextUsername = storedUser || `craftguest-${randomString(5)}`;
    const nextPassword = localStorage.getItem('ch_pass') || randomString(10);

    setUsername(nextUsername);
    setPassword(nextPassword);
    localStorage.setItem('ch_user', nextUsername);
    localStorage.setItem('ch_pass', nextPassword);

    setLoading(true);
    setMessage('Otomatik hesap oluşturuluyor...');

    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nextUsername, password: nextPassword, tosAccepted: true, captchaToken: '' })
      });
      const json = await res.json();
      if (json.ok) {
        localStorage.setItem('ch_token', json.token);
        if (json.apiKey) localStorage.setItem('ch_apiKey', json.apiKey);
        setToken(json.token);
        setMessage('Hesap hazır. Artık sunucunuzu oluşturabilirsiniz.');
        return json.token;
      }
      if (json.error && json.error.includes('User exists')) {
        return await loginExisting(nextUsername, nextPassword);
      }
      setMessage(`Hesap oluşturma hatası: ${json.error || 'Tekrar deneyin.'}`);
      return null;
    } catch (err) {
      setMessage('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loginExisting(loginUsername: string, loginPassword: string) {
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const json = await res.json();
      if (json.ok) {
        localStorage.setItem('ch_token', json.token);
        if (json.apiKey) localStorage.setItem('ch_apiKey', json.apiKey);
        setToken(json.token);
        setMessage('Mevcut hesap bulundu. Sunucunu oluşturabilirsin.');
        return json.token;
      }
      setMessage(`Giriş hatası: ${json.error || 'Tekrar deneyin.'}`);
      return null;
    } catch (err) {
      setMessage('Sunucuya bağlanılamadı.');
      return null;
    }
  }

  async function createServer() {
    const currentToken = token || await ensureAccount();
    if (!currentToken) return;

    setLoading(true);
    setMessage('Sunucunuzu kuruyoruz...');

    try {
      const res = await fetch(`${API}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          name: serverName,
          software,
          version,
          ram,
          onlineMode,
          plugins,
          sharedWith: []
        })
      });
      const json = await res.json();
      if (json.ok) {
        setServerInfo(json);
        setMessage('Sunucu hazır! Aşağıdaki bağlantıyla bağlanabilirsiniz.');
        await createDesktopShortcut(currentToken);
      } else {
        setMessage(`Sunucu kurulamadı: ${json.error || 'Tekrar deneyin.'}`);
      }
    } catch (err) {
      setMessage('Sunucu başlatılamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function createDesktopShortcut(currentToken: string) {
    if (!currentToken) return;
    setShortcutLoading(true);
    setShortcutMessage('Masaüstü kısayolu oluşturuluyor...');
    try {
      const res = await fetch(`${API}/shortcut`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({ url: 'http://localhost:3001', name: 'CraftHost', startup: false })
      });
      const json = await res.json();
      if (json.ok) {
        setShortcutCreated(true);
        setShortcutMessage('Masaüstü kısayolu oluşturuldu. Masaüstü dosyanızı kontrol edin.');
      } else {
        setShortcutMessage(`Kısayol oluşturulamadı: ${json.error || 'Tekrar deneyin.'}`);
      }
    } catch (err) {
      setShortcutMessage('Kısayol oluşturulamadı.');
    } finally {
      setShortcutLoading(false);
    }
  }

  async function ensurePublicServer() {
    setPublicLoading(true);
    setPublicMessage('Herkese açık sunucu başlatılıyor...');
    try {
      const res = await fetch(`${API}/join`);
      const json = await res.json();
      if (json.ok) {
        const server = json.server || json;
        setPublicServerInfo(server);
        setPublicMessage('Herkese açık sunucu hazır. Herkes bu adresle bağlanabilir.');
        return server;
      }
      setPublicMessage(`Herkese açık sunucu hatası: ${json.error || 'Tekrar deneyin.'}`);
      return null;
    } catch (err) {
      setPublicMessage('Herkese açık sunucuya bağlanılamadı.');
      return null;
    } finally {
      setPublicLoading(false);
    }
  }

  async function authorizeNgrok(currentToken: string) {
    if (!currentToken) return;
    setNgrokLoading(true);
    setNgrokMessage('Ngrok izin sayfası açılıyor...');
    try {
      window.open('https://dashboard.ngrok.com/get-started/your-authtoken', '_blank', 'noopener,noreferrer');
      const input = window.prompt('Ngrok authtoken değerini yapıştırın:', ngrokToken);
      if (!input) {
        setNgrokMessage('İzin işlemi iptal edildi.');
        return;
      }
      const res = await fetch(`${API}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({ NGROK_AUTHTOKEN: input.trim() })
      });
      const json = await res.json();
      if (json.ok) {
        localStorage.setItem('ch_ngrokToken', input.trim());
        setNgrokToken(input.trim());
        setNgrokMessage('Ngrok izni kaydedildi. Public tunnel denenecek.');
      } else {
        setNgrokMessage('Ngrok izni kaydedilemedi.');
      }
    } catch (err) {
      setNgrokMessage('Ngrok izni alınamadı.');
    } finally {
      setNgrokLoading(false);
    }
  }

  async function copyConnect() {
    if (!serverInfo) return;
    const connectString = serverInfo.connect || serverInfo.domain || `${serverInfo.host}:${serverInfo.port}`;
    try {
      await navigator.clipboard.writeText(connectString);
      setMessage('Bağlantı metni panoya kopyalandı!');
    } catch (e) {
      setMessage('Kopyalama yapılamadı, bağlantıyı elle kopyalayın.');
    }
  }

  async function copyPublicConnect() {
    if (!publicServerInfo) return;
    const connectString = publicServerInfo.connect || publicServerInfo.domain || `${publicServerInfo.host}:${publicServerInfo.port}`;
    try {
      await navigator.clipboard.writeText(connectString);
      setPublicMessage('Herkese açık bağlantı panoya kopyalandı!');
    } catch (e) {
      setPublicMessage('Kopyalama yapılamadı, bağlantıyı elle kopyalayın.');
    }
  }

  useEffect(() => {
    ensureAccount();
    ensurePublicServer();
  }, []);

  return (
    <main className="content wizardShell">
      <section className="wizardCard">
        <div className="wizardHeader">
          <div>
            <span className="wizardTag">Resmi Kurulum Sihirbazı</span>
            <h2>CraftHost Beta’ya Hoşgeldiniz</h2>
            <p>Yalnızca şu anda tıklayın, gerisini uygulama halledecek. Otomatik hesap, nefis plugin önerileri ve Aternos tarzı kolay sunucu oluşturma deneyimi.</p>
          </div>
          <div className="wizardMetric">
            <span>Beta</span>
            <strong>Hızlı Kurulum</strong>
          </div>
        </div>

        <div className="wizardSteps">
          <div className="wizardStep wizardStepActive">
            <div className="wizardStepTitle">1. Hazırlık</div>
            <div className="wizardStepSubtitle">Hesap ve ortam hazırlanır</div>
          </div>
          <div className="wizardStep">
            <div className="wizardStepTitle">2. Yapılandırma</div>
            <div className="wizardStepSubtitle">Sunucu ayarlarını seç</div>
          </div>
          <div className="wizardStep">
            <div className="wizardStepTitle">3. Başlat</div>
            <div className="wizardStepSubtitle">Sunucuyu aç ve oyna</div>
          </div>
        </div>

        <div className="wizardBody">
          <div className="wizardSection">
            <h3>Hesap Bilgileri</h3>
            <p className="text-muted">Hesabınız otomatik oluşturuldu. Siz sadece sunucunuzu seçin, kullanıcı ve parola arka planda saklanır.</p>
            <div className="fieldsGrid">
              <div className="inputGroup">
                <label>Kullanıcı Adı</label>
                <input value={username} readOnly />
              </div>
              <div className="inputGroup">
                <label>Parola</label>
                <input value={password} readOnly />
              </div>
            </div>
          </div>

          <div className="wizardSection">
            <h3>Sunucu Ayarları</h3>
            <div className="fieldsGrid">
              <div className="inputGroup fullWidth">
                <label>Sunucu Adı</label>
                <input value={serverName} onChange={e => setServerName(e.target.value)} placeholder="CraftHost Sunucusu" />
              </div>
              <div className="inputGroup">
                <label>Yazılım</label>
                <select value={software} onChange={e => setSoftware(e.target.value)}>
                  <option>Paper</option>
                  <option>Purpur</option>
                  <option>Folia</option>
                  <option>Fabric</option>
                  <option>Forge</option>
                </select>
              </div>
              <div className="inputGroup">
                <label>Sürüm</label>
                <select value={version} onChange={e => setVersion(e.target.value)}>
                  {supportedVersions.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="inputGroup">
                <label>RAM</label>
                <input type="range" min={1} max={16} value={ram} onChange={e => setRam(Number(e.target.value))} />
                <div className="rangeLabel">{ram} GB</div>
              </div>
              <div className="inputGroup">
                <label>Online Mode</label>
                <select value={onlineMode ? 'true' : 'false'} onChange={e => setOnlineMode(e.target.value === 'true')}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </div>
            </div>
          </div>

          <div className="wizardSection">
            <div className="sectionHeader">
              <h3>Public Bağlantı İzni</h3>
              <span className="text-muted">Ngrok hesabı ile public tunnel izni alıp sunucunuzu herkese açık hale getirin.</span>
            </div>
            <div className="fieldsGrid">
              <div className="inputGroup fullWidth">
                <label>Ngrok erişim anahtarı</label>
                <input value={ngrokToken} onChange={e => setNgrokToken(e.target.value)} placeholder="Ngrok authtoken" />
              </div>
            </div>
            <div className="wizardFooter" style={{ marginTop: 12 }}>
              <div>
                <p className="text-muted">{ngrokMessage}</p>
              </div>
              <button className="smallButton" onClick={() => authorizeNgrok(token || '')} disabled={ngrokLoading}>
                {ngrokLoading ? 'İzin alınıyor...' : 'İzin Al'}
              </button>
            </div>
          </div>

          <div className="wizardSection">
            <div className="sectionHeader">
              <h3>Önerilen Eklentiler</h3>
              <span className="text-muted">Aternos tarzı hazır tavsiyeler</span>
            </div>
            <div className="pluginGrid">
              {recommendedPlugins.map(plugin => (
                <label key={plugin} className={`pluginTile ${plugins.includes(plugin) ? 'pluginActive' : ''}`}>
                  <input
                    type="checkbox"
                    checked={plugins.includes(plugin)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...plugins, plugin]
                        : plugins.filter(p => p !== plugin);
                      setPlugins(next);
                    }}
                  />
                  <span>{plugin}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="wizardFooter">
            <div>
              <h4>Hızlı Başlatalım</h4>
              <p className="text-muted">Tek bir tıklamayla sunucunuzu başlatın. Beta sürümde kurulumu basitleştirdik.</p>
            </div>
            <button className="bigButton" onClick={createServer} disabled={loading}>
              {loading ? 'Sunucu kuruluyor...' : 'Sunucu Oluştur'}
            </button>
          </div>

          <div className="statusBox">
            <p>{message}</p>
            {serverInfo && (
              <div>
                <div className="serverCard">
                  <h4>Sunucu Hazır</h4>
                  <p><strong>Sunucu adı:</strong> {serverInfo.name || serverName}</p>
                  <p><strong>Yazılım:</strong> {serverInfo.software || software}</p>
                  <p><strong>Sürüm:</strong> {serverInfo.version || version}</p>
                  <p><strong>Port:</strong> {serverInfo.port || 25565}</p>
                  <p><strong>Bağlantı:</strong> <code>{serverInfo.connect || serverInfo.domain || `${serverInfo.host}:${serverInfo.port}`}</code></p>
                  {serverInfo.domain && <p><strong>Domain:</strong> {serverInfo.domain}</p>}
                </div>
                {publicServerInfo && (
                  <div className="publicCard">
                    <h4>Herkese Açık Sunucu</h4>
                    <p>Bu adres herkesin bağlanabileceği genel sunucu adresi:</p>
                    <p className="publicConnect">{publicServerInfo.connect || publicServerInfo.domain || `${publicServerInfo.host}:${publicServerInfo.port}`}</p>
                    <div className="actionRow">
                      <button className="smallButton" onClick={copyPublicConnect}>Public Bağlantıyı Kopyala</button>
                      <button className="smallButton secondary" onClick={ensurePublicServer} disabled={publicLoading}>{publicLoading ? 'Yenileniyor...' : 'Yenile'}</button>
                    </div>
                    <p className="text-muted">Herkes bu adresi Minecraft'ta Direct Connect olarak kullanabilir.</p>
                  </div>
                )}
                <div className="supportCard">
                  <h4>Telefon Desteği</h4>
                  <p>7/24 telefon ve WhatsApp desteği için:</p>
                  <p><strong>+90 555 555 55 55</strong></p>
                  <p>Destek hattımıza istediğiniz zaman ulaşabilirsiniz. Mobil cihazlarda da bu arayüz tam uyumludur.</p>
                  <button className="smallButton" onClick={copyConnect}>Sunucu Bağlantısını Kopyala</button>
                </div>
                <div className="supportCard">
                  <h4>Masaüstü Kısayolu</h4>
                  <p>{shortcutMessage}</p>
                  <button className="smallButton" onClick={() => createDesktopShortcut(token || '')} disabled={shortcutLoading || shortcutCreated}>
                    {shortcutLoading ? 'Oluşturuluyor...' : shortcutCreated ? 'Kısayol Oluşturuldu' : 'Masaüstü Kısayolu Oluştur'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
