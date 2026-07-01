import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function makeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const editSiteUrl    = Deno.env.get('EDIT_SITE_URL')    ?? 'https://edit.md-hanif.xyz';
  const portfolioBase  = Deno.env.get('PORTFOLIO_BASE')   ?? 'md-hanif.xyz';
  const cfApiToken  = Deno.env.get('CF_API_TOKEN');
  const cfZoneId    = Deno.env.get('CF_ZONE_ID');
  const cfOriginIp  = Deno.env.get('CF_ORIGIN_IP') ?? '';

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request body' }, 400); }

  const { name, email, subdomain, password, templateId } = body as Record<string, string>;

  if (!name?.trim() || name.trim().length < 2)
    return json({ error: 'Name is required' }, 400);
  if (!email?.includes('@'))
    return json({ error: 'Valid email is required' }, 400);
  if (!subdomain || subdomain.length < 3 || subdomain.length > 30 || !SUBDOMAIN_RE.test(subdomain))
    return json({ error: 'Invalid subdomain' }, 400);
  if (!password || password.length < 8)
    return json({ error: 'Password must be at least 8 characters' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Subdomain uniqueness
  const { count } = await sb
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('subdomain', subdomain);
  if (count && count > 0) return json({ error: 'Subdomain already taken' }, 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Insert customer
  const { data: customer, error: custErr } = await sb
    .from('customers')
    .insert({
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      subdomain,
      plan:          'trial',
      template_id:   templateId ?? 'photographer-red',
      is_active:     true,
      password_hash: passwordHash,
      expires_at:    expiresAt,
    })
    .select('id')
    .single();

  if (custErr) {
    console.error('Customer insert:', custErr.message);
    return json({ error: custErr.message }, 500);
  }

  // Create portfolio_content row — required for both the edit portal and the
  // live site to find this customer; the template_id sync trigger only
  // updates an existing row, it never creates one.
  const { error: contentErr } = await sb.from('portfolio_content').insert({
    customer_id: customer.id,
    subdomain,
    template_id: templateId ?? 'photographer-red',
  });

  if (contentErr) {
    console.error('Portfolio content insert:', contentErr.message);
    return json({ error: contentErr.message }, 500);
  }

  // Create edit token (24 h)
  const token      = makeToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenErr } = await sb.from('edit_tokens').insert({
    customer_id: customer.id,
    subdomain,
    token,
    used:       false,
    expires_at: tokenExpiry,
  });

  if (tokenErr) {
    // Retry without subdomain column in case migration not yet applied
    const { error: tokenErr2 } = await sb.from('edit_tokens').insert({
      customer_id: customer.id,
      token,
      used:       false,
      expires_at: tokenExpiry,
    });
    if (tokenErr2) {
      console.error('Token insert:', tokenErr2.message);
      return json({ error: tokenErr2.message }, 500);
    }
  }

  // Create Cloudflare DNS CNAME (proxied) — non-fatal if secrets missing
  if (cfApiToken && cfZoneId) {
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            type:    'A',
            name:    `${subdomain}.${portfolioBase}`,
            content: cfOriginIp,
            proxied: true,
            ttl:     1,
          }),
        },
      );
      if (!cfRes.ok) {
        const cfErr = await cfRes.json() as { errors?: unknown[] };
        // Code 81057 = record already exists — safe to ignore
        const alreadyExists = (cfErr.errors as Array<{ code: number }> | undefined)
          ?.some((e) => e.code === 81057);
        if (!alreadyExists) {
          console.error('Cloudflare DNS error:', JSON.stringify(cfErr));
        }
      }
    } catch (e) {
      console.error('Cloudflare DNS request failed:', e);
    }
  } else {
    console.warn('CF_API_TOKEN or CF_ZONE_ID not set — DNS record skipped');
  }

  const magicLink = `${editSiteUrl.replace(/\/$/, '')}/${token}`;
  const siteUrl   = `https://${subdomain}.${portfolioBase}`;

  return json({ magicLink, siteUrl, subdomain, expiresAt: tokenExpiry });
});
