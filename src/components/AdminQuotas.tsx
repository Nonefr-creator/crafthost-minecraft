import { useState, useEffect } from 'react';

export default function AdminQuotas(){
  const [planFreeLimit, setPlanFreeLimit] = useState(2);
  const [saving, setSaving] = useState(false);

  function save(){
    // placeholder: persist to backend in future
    setSaving(true);
    setTimeout(()=>{ setSaving(false); alert('Quota saved (local)'); }, 600);
  }

  return (
    <div className="card">
      <h3>Quotas</h3>
      <div style={{ display: 'grid', gap:8 }}>
        <label>Free plan RAM (GB max per instance)</label>
        <input type="number" value={planFreeLimit} onChange={e=>setPlanFreeLimit(Number(e.target.value))} />

        <label>Free plan concurrent instances</label>
        <input type="number" value={2} disabled />

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={save} disabled={saving}>{saving? 'Saving...':'Save quotas'}</button>
        </div>
      </div>
    </div>
  );
}
