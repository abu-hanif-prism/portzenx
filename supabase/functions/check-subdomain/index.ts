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

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const { subdomain } = await req.json().catch(() => ({ subdomain: '' }));
  if (typeof subdomain !== 'string' || subdomain.length < 3 || subdomain.length > 30 || !SUBDOMAIN_RE.test(subdomain)) {
    return json({ error: 'Invalid subdomain' }, 400);
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { count, error } = await sb
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('subdomain', subdomain);

  if (error) return json({ error: error.message }, 500);
  return json({ available: !count || count === 0 });
});
