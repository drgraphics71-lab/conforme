import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_DEFAUT, SUPABASE_URL_DEFAUT } from './config';

// Le .env prime quand il existe ; sinon on retombe sur config.ts.
const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_DEFAUT;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_DEFAUT;

export const supabase = createClient(url, cle, {
  auth: { persistSession: true, autoRefreshToken: true },
});
