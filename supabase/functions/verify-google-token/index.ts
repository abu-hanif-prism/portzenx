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

  const supabaseUrl   = Deno.env.get('SUPABASE_URL')!;
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');

  if (!googleClientId) return json({ error: 'Google sign-in is not configured yet.' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request body' }, 400); }

  const idToken = body.idToken as string | undefined;
  if (!idToken) return json({ error: 'Missing Google credential' }, 400);

  // Google verifies the token's signature/expiry for us here — no local JWKS
  // handling needed. We still must check `aud` ourselves: tokeninfo will
  // happily validate a token issued for a DIFFERENT app, so skipping that
  // check would let anyone replay a Google login from an unrelated site.
  let claims: Record<string, string>;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return json({ error: 'Invalid or expired Google credential' }, 401);
    claims = await res.json();
  } catch {
    return json({ error: 'Could not verify Google credential' }, 502);
  }

  if (claims.aud !== googleClientId) return json({ error: 'Google credential was not issued for this app' }, 401);
  if (claims.email_verified !== 'true') return json({ error: 'Google account email is not verified' }, 401);
  if (!claims.email?.includes('@')) return json({ error: 'No email on Google credential' }, 400);

  const email = claims.email.trim().toLowerCase();
  const name  = claims.name ?? '';

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Reuse the exact same "verified OTP" row the manual email flow writes —
  // signup/create-checkout/generate-token all just check for one of these
  // dated within the last 30 minutes, so this is a drop-in replacement that
  // needs no changes to any of those three functions.
  const { error } = await sb.from('signup_otps').insert({
    email,
    code: makeCode(),
    verified: true,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) return json({ error: error.message }, 500);

  return json({ verified: true, email, name });
});
