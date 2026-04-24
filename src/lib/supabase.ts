import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

/** 若缺少 .env，不 throw，避免匯入階段白屏；API 仍會失敗，Console 可見。 */
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Thouse] 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY。請在專案根目錄建立 .env.local（可複製 .env.example）。'
  );
}

const fallbackUrl = 'https://placeholder-not-configured.local';
const fallbackKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJwbGFjZWhvbGRlciJ9.invalid-signature';

export const supabase = createClient(
  supabaseUrl || fallbackUrl,
  supabaseAnonKey || fallbackKey,
  { auth: { persistSession: Boolean(supabaseUrl && supabaseAnonKey) } }
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
