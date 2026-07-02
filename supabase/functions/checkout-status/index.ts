import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const editSiteUrl = Deno.env.get('EDIT_SITE_URL')  ?? 'https://edit.portzenx.com';
  const portfolioBase = Deno.env.get('PORTFOLIO_BASE') ?? 'portzenx.com';

  const tranId = new URL(req.url).searchParams.get('tran_id');
  if (!tranId) return json({ error: 'tran_id is required' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: order, error } = await sb
    .from('orders')
    .select('status,subdomain,customer_id')
    .eq('tran_id', tranId)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!order) return json({ error: 'Unknown order' }, 404);

  if (order.status !== 'paid') return json({ status: order.status });

  const { data: tokenRow } = await sb
    .from('edit_tokens')
    .select('token')
    .eq('customer_id', order.customer_id as string)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return json({
    status: 'paid',
    siteUrl: `https://${order.subdomain}.${portfolioBase}`,
    magicLink: tokenRow ? `${editSiteUrl.replace(/\/$/, '')}/${tokenRow.token}` : null,
  });
});
