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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request body' }, 400); }

  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const code  = (body.code as string | undefined)?.trim();
  if (!email?.includes('@')) return json({ error: 'Valid email is required' }, 400);
  if (!code || !/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: row, error } = await sb
    .from('signup_otps')
    .select('id,code,verified,expires_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!row) return json({ error: 'No code was requested for this email.' }, 400);
  if (new Date(row.expires_at as string) < new Date())
    return json({ error: 'Code expired. Request a new one.' }, 400);
  if (row.code !== code) return json({ error: 'Incorrect code.' }, 400);

  if (!row.verified) {
    const { error: updateErr } = await sb.from('signup_otps').update({ verified: true }).eq('id', row.id as string);
    if (updateErr) return json({ error: updateErr.message }, 500);
  }

  return json({ verified: true });
});
