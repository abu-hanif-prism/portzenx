import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface CustomerRecord {
  id: string;
  subdomain: string;
  email: string;
  expires_at: string;
}

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

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const editSiteUrl = Deno.env.get('EDIT_SITE_URL') ?? 'https://edit.md-hanif.xyz';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is missing Supabase configuration.' }, 500);
  }

  const { customerId, email } = await request.json().catch(() => ({ customerId: '', email: '' }));
  if (typeof customerId !== 'string' || customerId.trim().length === 0) {
    return json({ error: 'Customer ID or subdomain is required.' }, 400);
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return json({ error: 'Valid email is required.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const normalizedEmail = email.trim().toLowerCase();
  const accountId = customerId.trim();
  const customerQuery = supabase
    .from('customers')
    .select('id,subdomain,email,expires_at')
    .gt('expires_at', new Date().toISOString());

  const { data: customer, error } = isUuid(accountId)
    ? await customerQuery.eq('id', accountId).maybeSingle<CustomerRecord>()
    : await customerQuery.eq('subdomain', accountId).maybeSingle<CustomerRecord>();

  if (error) {
    return json({ error: error.message }, 500);
  }

  if (!customer) {
    return json({ error: 'Invalid customer ID or expired subscription.' }, 401);
  }

  if (customer.email?.trim().toLowerCase() !== normalizedEmail) {
    return json({ error: 'That email does not match this account.' }, 401);
  }

  // Email must have a verified OTP from the last 30 minutes, same freshness
  // window used at signup — replaces the old password check.
  const { data: otpRow } = await supabase
    .from('signup_otps')
    .select('verified,created_at')
    .eq('email', normalizedEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const otpFresh = otpRow?.verified
    && Date.now() - new Date(otpRow.created_at as string).getTime() < 30 * 60 * 1000;
  if (!otpFresh) {
    return json({ error: 'Please verify your email before continuing.' }, 403);
  }

  const token = createToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('edit_tokens').insert({
    customer_id: customer.id,
    subdomain: customer.subdomain,
    token,
    used: false,
    expires_at: expiresAt,
  });

  if (insertError) {
    return json({ error: insertError.message }, 500);
  }

  const magicLink = `${editSiteUrl.replace(/\/$/, '')}/${token}`;
  return json({ magicLink, expiresAt });
});
