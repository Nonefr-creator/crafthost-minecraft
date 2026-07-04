import AdminConfig from '../components/AdminConfig';
import AdminQuotas from '../components/AdminQuotas';

export default function AdminPanel(){
  return (
    <main className="content admin">
      <header className="header">
        <div>
          <h2>Admin Panel</h2>
          <p>Manage tokens, quotas, bans and site settings</p>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <AdminConfig />
        <AdminQuotas />
      </section>

    </main>
  );
}
