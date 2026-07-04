export default function Sidebar({ onNavigate, active }: { onNavigate: (p: string)=>void, active: string }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <h1>CraftHost</h1>
        <span>v0.1 Alpha</span>
      </div>

      <nav>
        <button className={active==='dashboard'? 'active':''} onClick={()=>onNavigate('dashboard')}>🏠 Dashboard</button>
        <button className={active==='setup'? 'active':''} onClick={()=>onNavigate('setup')}>🛠 Kurulum Sihirbazı</button>
        <button className={active==='create'? 'active':''} onClick={()=>onNavigate('create')}>➕ Oluştur</button>
        <button className={active==='admin'? 'active':''} onClick={()=>onNavigate('admin')}>🔒 Admin</button>
      </nav>
    </aside>
  );
}