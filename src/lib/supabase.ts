import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://example.supabase.co',
  supabaseAnonKey ?? 'missing-anon-key',
);

// Admin client — bypasses RLS. Used only in the admin panel for writes.
// No Database generic so update/insert accept plain objects without strict schema inference.
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin;

export const whatsappNumber =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '8801700000000';

/**
 * supabase-js's functions.invoke() error is a generic "Edge Function returned
 * a non-2xx status code" — the real message our functions return in the JSON
 * body only lives on `error.context` (the raw Response). Extract it here.
 */
export async function functionErrorMessage(err: unknown): Promise<string> {
  const context = (err as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json() as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // response body wasn't JSON — fall through to the generic message
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
