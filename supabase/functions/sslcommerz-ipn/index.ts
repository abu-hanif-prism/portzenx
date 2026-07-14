import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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

const PLAN_DAYS: Record<string, number> = {
  six_months: 182,
  one_year: 365,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // SSLCommerz posts the IPN as application/x-www-form-urlencoded.
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const storeId     = Deno.env.get('SSLCOMMERZ_STORE_ID');
  const storePasswd = Deno.env.get('SSLCOMMERZ_STORE_PASSWORD');
  const sslBase     = Deno.env.get('SSLCOMMERZ_BASE_URL') ?? 'https://sandbox.sslcommerz.com';
  const editSiteUrl = Deno.env.get('EDIT_SITE_URL')  ?? 'https://edit.portzenx.com';
  const portfolioBase = Deno.env.get('PORTFOLIO_BASE') ?? 'portzenx.com';
  const cfApiToken  = Deno.env.get('CF_API_TOKEN');
  const cfZoneId    = Deno.env.get('CF_ZONE_ID');
  const cfOriginIp  = Deno.env.get('CF_ORIGIN_IP') ?? '';

  if (!storeId || !storePasswd) return json({ error: 'Payment gateway is not configured' }, 503);

  const form   = await req.formData().catch(() => null);
  const tranId = form?.get('tran_id')?.toString();
  const valId  = form?.get('val_id')?.toString();
  if (!tranId || !valId) return json({ error: 'Missing tran_id or val_id' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .select('*')
    .eq('tran_id', tranId)
    .maybeSingle();
  if (orderErr || !order) return json({ error: 'Unknown order' }, 404);

  // Already processed — acknowledge without re-creating anything.
  if (order.status === 'paid') return json({ ok: true, already: true });

  // Validate with SSLCommerz directly — never trust the IPN payload alone,
  // since a POST to this URL could in principle be forged.
  const valUrl = `${sslBase}/validator/api/validationserverAPI.php`
    + `?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(storeId)}`
    + `&store_passwd=${encodeURIComponent(storePasswd)}&format=json`;

  const valRes  = await fetch(valUrl);
  const valData = await valRes.json() as {
    status?: string; tran_id?: string; amount?: string; currency?: string;
  };

  const isValid = (valData.status === 'VALID' || valData.status === 'VALIDATED')
    && valData.tran_id === tranId
    && Math.round(Number(valData.amount)) === Math.round(Number(order.amount));

  if (!isValid) {
    await sb.from('orders').update({ status: 'failed', val_id: valId, updated_at: new Date().toISOString() }).eq('tran_id', tranId);
    return json({ ok: true, valid: false });
  }

  const days       = PLAN_DAYS[order.plan as string] ?? 30;
  const expiresAt  = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: customer, error: custErr } = await sb
    .from('customers')
    .insert({
      name:          order.name,
      email:         order.email,
      subdomain:     order.subdomain,
      plan:          order.plan,
      template_id:   order.template_id,
      is_active:     true,
      password_hash: order.password_hash,
      expires_at:    expiresAt,
      user_id:       order.user_id,
    })
    .select('id')
    .single();

  if (custErr) {
    console.error('IPN customer insert:', custErr.message);
    return json({ error: custErr.message }, 500);
  }

  await sb.from('portfolio_content').insert({
    customer_id: customer.id,
    subdomain:   order.subdomain,
    template_id: order.template_id,
  });

  const token       = makeToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await sb.from('edit_tokens').insert({
    customer_id: customer.id,
    subdomain:   order.subdomain,
    token,
    used:        false,
    expires_at:  tokenExpiry,
  });

  if (cfApiToken && cfZoneId) {
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfApiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'A', name: `${order.subdomain}.${portfolioBase}`, content: cfOriginIp, proxied: true, ttl: 1,
          }),
        },
      );
      if (!cfRes.ok) {
        const cfErr = await cfRes.json() as { errors?: Array<{ code: number }> };
        const alreadyExists = cfErr.errors?.some((e) => e.code === 81057);
        if (!alreadyExists) console.error('Cloudflare DNS error:', JSON.stringify(cfErr));
      }
    } catch (e) {
      console.error('Cloudflare DNS request failed:', e);
    }
  }

  await sb.from('orders').update({
    status: 'paid', val_id: valId, customer_id: customer.id, updated_at: new Date().toISOString(),
  }).eq('tran_id', tranId);

  console.log(`[sslcommerz-ipn] order ${tranId} paid, customer ${customer.id} created, magic link ${editSiteUrl}/${token}`);

  return json({ ok: true, valid: true });
});
