const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function validateToken(token, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/edit_tokens?token=eq.${encodeURIComponent(token)}&select=id,subdomain,used,expires_at&limit=1`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  if (!rows?.length) return { ok: false, msg: 'Token not found' };
  const row = rows[0];
  if (row.used)                              return { ok: false, msg: 'Token already used' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, msg: 'Token expired' };
  return { ok: true, subdomain: row.subdomain };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health')    return json({ status: 'ok' });

    if (url.pathname === '/upload') {
      if (request.method === 'POST')   return handleUpload(request, env);
      if (request.method === 'DELETE') return handleDelete(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },
};

async function handleUpload(request, env) {
  let formData;
  try { formData = await request.formData(); }
  catch { return json({ error: 'Invalid form data' }, 400); }

  const file      = formData.get('file');
  const subdomain = formData.get('subdomain');
  const token     = formData.get('token');
  const slot      = formData.get('slot');

  if (!file || !subdomain || !token || !slot)
    return json({ error: 'Missing required fields' }, 400);

  if (!/^[a-z0-9-]+$/.test(subdomain) || !/^[a-z0-9_-]+$/.test(slot))
    return json({ error: 'Invalid subdomain or slot' }, 400);

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return json({ error: 'Only jpg/png/webp allowed' }, 400);

  const check = await validateToken(token, env);
  if (!check.ok)                    return json({ error: check.msg }, 401);
  if (check.subdomain !== subdomain) return json({ error: 'Token subdomain mismatch' }, 403);

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024)
    return json({ error: 'File too large (max 5MB)' }, 400);

  const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
  const key = `uploads/${subdomain}/${slot}${ext}`;

  await env.R2.put(key, bytes, { httpMetadata: { contentType: file.type } });

  return json({ success: true, path: `${env.R2_PUBLIC_URL}/${key}` });
}

async function handleDelete(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { subdomain, token, slot } = body;
  if (!subdomain || !token || !slot)
    return json({ error: 'Missing required fields' }, 400);

  const check = await validateToken(token, env);
  if (!check.ok)                    return json({ error: check.msg }, 401);
  if (check.subdomain !== subdomain) return json({ error: 'Token subdomain mismatch' }, 403);

  const listed = await env.R2.list({ prefix: `uploads/${subdomain}/${slot}` });
  await Promise.all(listed.objects.map(obj => env.R2.delete(obj.key)));

  return json({ success: true });
}
