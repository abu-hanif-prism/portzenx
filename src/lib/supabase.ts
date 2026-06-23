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
