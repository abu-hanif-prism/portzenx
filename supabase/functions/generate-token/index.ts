import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface CustomerRecord {
  id: string;
  subdomain: string;
  user_id: string | null;
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const editSiteUrl = Deno.env.get('EDIT_SITE_URL') ?? 'https://edit.portzenx.com';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server is missing Supabase configuration.' }, 500);
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Please log in to get an edit link.' }, 401);

  const { customerId } = await request.json().catch(() => ({ customerId: '' }));
  if (typeof customerId !== 'string' || customerId.trim().length === 0) {
    return json({ error: 'Customer ID is required.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id,subdomain,user_id')
    .eq('id', customerId.trim())
    .maybeSingle<CustomerRecord>();

  if (error) {
    return json({ error: error.message }, 500);
  }

  if (!customer || customer.user_id !== user.id) {
    return json({ error: 'Site not found on your account.' }, 404);
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
