import { useEffect, useState } from "react";

export default function PublicServer() {
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const API = "http://localhost:3001";
  const publicDomain = 'play.crafthost.dev';

  async function joinPublic() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/join`);
      const json = await res.json();
      if (json.ok) {
        const store = json.server || json;
        setServer(store);
      } else {
        setError(json.error || 'Sunucu başlatılamadı');
      }
    } catch (e) {
      setError('Ağ hatası: ' + (e instanceof Error ? e.message : ''));
    }
    setLoading(false);
  }

  async function copyPublicAddress() {
    if (!server) return;
    const address = server.connect || server.domain || `${server.host}:${server.tunnelPort || server.port}`;
    try {
      await navigator.clipboard.writeText(address);
      setError('Adres panoya kopyalandı!');
    } catch (e) {
      setError('Kopyalama başarısız. Adresi elle kopyalayın.');
    }
  }

  useEffect(() => {
    joinPublic();
  }, []);

  const connectAddress = server ? (server.connect || server.domain || `${server.host}:${server.tunnelPort || server.port}`) : publicDomain;

  return (
    <div className="card">
      <h3>Herkese Açık Sunucu</h3>
      <p>Herkese açık sunucunu otomatik başlat ve sabit domain ile hızlıca paylaş.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <button onClick={joinPublic} disabled={loading}>
          {loading ? 'Başlatılıyor...' : 'Tek Tıkla Aç'}
        </button>
        <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
          <p style={{ margin: '0 0 8px' }}><strong>Sabit Domain:</strong> {publicDomain}</p>
          <p style={{ margin: 0 }}><strong>Bağlan:</strong> <span style={{ wordBreak: 'break-all' }}>{connectAddress}</span></p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="smallButton" onClick={copyPublicAddress} disabled={!server}>Adresi Kopyala</button>
          <button className="smallButton secondary" onClick={joinPublic} disabled={loading}>Yeniden Başlat</button>
        </div>
        <p style={{ margin: 0, color: '#94a3b8' }}>Bu adresi oyunculara gönder, onlar doğrudan Minecraft’ta Direct Connect ile bağlanabilir.</p>
        {error && <div style={{ color: '#f97316', fontWeight: 600 }}>{error}</div>}
      </div>
    </div>
  );
}
