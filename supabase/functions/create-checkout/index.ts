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

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

// Paid plans only — Custom has no fixed price and stays on the WhatsApp flow.
const PLAN_AMOUNT: Record<string, number> = {
  six_months: 300,
  one_year: 500,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl     = (Deno.env.get('SITE_URL') ?? 'https://portzenx.com').replace(/\/$/, '');
  const storeId     = Deno.env.get('SSLCOMMERZ_STORE_ID');
  const storePasswd = Deno.env.get('SSLCOMMERZ_STORE_PASSWORD');
  const sslBase     = Deno.env.get('SSLCOMMERZ_BASE_URL') ?? 'https://sandbox.sslcommerz.com';

  if (!storeId || !storePasswd) {
    return json({ error: 'Payment gateway is not configured yet. Please contact support on WhatsApp instead.' }, 503);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Please log in before checking out.' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request body' }, 400); }

  const { subdomain, templateId, plan } = body as Record<string, string>;

  if (!subdomain || subdomain.length < 3 || subdomain.length > 30 || !SUBDOMAIN_RE.test(subdomain))
    return json({ error: 'Invalid subdomain' }, 400);
  const amount = PLAN_AMOUNT[plan];
  if (!amount) return json({ error: 'Unsupported plan for online checkout' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('name,phone')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr || !profile) return json({ error: 'Please complete your profile before continuing.' }, 403);

  const { count } = await sb
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('subdomain', subdomain);
  if (count && count > 0) return json({ error: 'Subdomain already taken' }, 409);

  // No client-supplied password anymore — access is purely via the magic edit
  // link. Still populate password_hash with an unguessable random value since
  // the column is non-nullable; it's never used to authenticate.
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const tranId        = `pz_${crypto.randomUUID().replace(/-/g, '')}`;

  const { error: orderErr } = await sb.from('orders').insert({
    tran_id:       tranId,
    name:          profile.name,
    email:         user.email,
    subdomain,
    template_id:   templateId ?? 'photographer-red',
    password_hash: passwordHash,
    plan,
    amount,
    status:        'pending',
    user_id:       user.id,
  });
  if (orderErr) return json({ error: orderErr.message }, 500);

  const params = new URLSearchParams({
    store_id:        storeId,
    store_passwd:    storePasswd,
    total_amount:    String(amount),
    currency:        'BDT',
    tran_id:         tranId,
    success_url:     `${siteUrl}/checkout-result?tran_id=${tranId}&status=success`,
    fail_url:        `${siteUrl}/checkout-result?tran_id=${tranId}&status=fail`,
    cancel_url:      `${siteUrl}/checkout-result?tran_id=${tranId}&status=cancel`,
    ipn_url:         `${supabaseUrl}/functions/v1/sslcommerz-ipn`,
    shipping_method: 'NO',
    product_name:    `PortZen ${plan} plan`,
    product_category:'Portfolio hosting',
    product_profile: 'general',
    cus_name:        profile.name,
    cus_email:       user.email ?? '',
    cus_add1:        'N/A',
    cus_city:        'Dhaka',
    cus_country:     'Bangladesh',
    cus_phone:       profile.phone,
  });

  let gatewayUrl: string;
  try {
    const sslRes = await fetch(`${sslBase}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const sslData = await sslRes.json() as { status?: string; GatewayPageURL?: string; failedreason?: string };
    if (sslData.status !== 'SUCCESS' || !sslData.GatewayPageURL) {
      await sb.from('orders').update({ status: 'failed' }).eq('tran_id', tranId);
      return json({ error: sslData.failedreason ?? 'Payment gateway session could not be created.' }, 502);
    }
    gatewayUrl = sslData.GatewayPageURL;
  } catch (e) {
    await sb.from('orders').update({ status: 'failed' }).eq('tran_id', tranId);
    return json({ error: 'Payment gateway request failed.' }, 502);
  }

  return json({ gatewayUrl, tranId });
});
