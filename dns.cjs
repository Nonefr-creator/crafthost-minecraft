const fetch = global.fetch || require('node-fetch');
const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_TOKEN;
const CLOUDFLARE_ZONE = process.env.CLOUDFLARE_ZONE;

async function setSrvRecord(domain, target, port, opts = {}) {
  if (!CLOUDFLARE_TOKEN || !CLOUDFLARE_ZONE) return { ok: false, error: 'no-dns-config' };
  const name = `_minecraft._tcp.${domain}`;
  const url = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE}/dns_records`;

  const body = {
    type: 'SRV',
    name,
    data: {
      service: '_minecraft',
      proto: '_tcp',
      name: domain,
      priority: opts.priority || 0,
      weight: opts.weight || 5,
      port: Number(port),
      target: target
    }
  };

  // Try to find existing SRV record
  const listUrl = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE}/dns_records?type=SRV&name=${encodeURIComponent(name)}`;
  try {
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' } });
    const listJson = await listRes.json();
    if (listJson && listJson.result && listJson.result.length > 0) {
      const id = listJson.result[0].id;
      const res = await fetch(`${url}/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      return j;
    } else {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      return j;
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function removeSrvRecord(domain) {
  if (!CLOUDFLARE_TOKEN || !CLOUDFLARE_ZONE) return { ok: false, error: 'no-dns-config' };
  const name = `_minecraft._tcp.${domain}`;
  const listUrl = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE}/dns_records?type=SRV&name=${encodeURIComponent(name)}`;
  try {
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' } });
    const listJson = await listRes.json();
    if (listJson && listJson.result && listJson.result.length > 0) {
      const id = listJson.result[0].id;
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE}/dns_records/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' } });
      const j = await res.json();
      return j;
    }
    return { ok: true, message: 'no-record' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { setSrvRecord, removeSrvRecord };
