import { useEffect, useState } from "react";
import ServerControl from "../components/ServerControl";
import PublicServer from "../components/PublicServer";

export default function Dashboard() {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setUserName(localStorage.getItem('ch_user'));
  }, []);

  return (
    <main className="content">
      <header className="header">
        <div className="pageTitle">
          <div>
            <h2>{userName ? `Hoş geldin, ${userName}!` : 'CraftHost\'e hoş geldin'}</h2>
            <p>{userName ? 'Kendi sunucunu yönet, genel sunucuya hızlıca bağlan.' : 'Giriş yap veya kaydol, Minecraft sunucunu birkaç saniyede başlat.'}</p>
          </div>
        </div>
        <button className="button primary">+ Yeni Sunucu</button>
      </header>

      <section className="statsGrid">
        <div className="statCard">
          <span>Toplam Sunucu</span>
          <strong>0</strong>
        </div>
        <div className="statCard">
          <span>Çalışan</span>
          <strong>0</strong>
        </div>
        <div className="statCard">
          <span>RAM Kullanımı</span>
          <strong>0 GB</strong>
        </div>
        <div className="statCard">
          <span>Sunucu Sağlığı</span>
          <strong>%100</strong>
        </div>
      </section>

      <section className="panelGrid">
        <PublicServer />
        <ServerControl />
      </section>
    </main>
  );
}