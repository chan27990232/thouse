import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('admin-portal: 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY（可複製主專案 .env）');
}

export const supabase = createClient(url, key);
