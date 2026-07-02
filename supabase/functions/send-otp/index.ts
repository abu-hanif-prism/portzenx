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

function makeCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
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
  if (!email?.includes('@')) return json({ error: 'Valid email is required' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Basic anti-spam: no more than one active code every 60 seconds per email.
  const { data: recent } = await sb
    .from('signup_otps')
    .select('created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at as string).getTime() < 60_000) {
    return json({ error: 'Please wait a minute before requesting another code.' }, 429);
  }

  const code      = makeCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await sb.from('signup_otps').insert({ email, code, expires_at: expiresAt });
  if (error) return json({ error: error.message }, 500);

  // TODO: replace with a real transactional email send (e.g. Resend) once
  // that's wired up. For now the code is only visible in these function logs
  // (Supabase dashboard → Edge Functions → send-otp → Logs) so only the admin
  // can read it while testing this flow — it is never returned to the client.
  console.log(`[send-otp] verification code for ${email}: ${code} (expires ${expiresAt})`);

  return json({ ok: true });
});
