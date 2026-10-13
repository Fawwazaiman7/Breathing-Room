import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !publicKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check frontend/.env.',
  );
}

/**
 * Browser client. It uses the public key, so it can only do what the Row
 * Level Security policies allow: sign in and read the user's own rows.
 */
export const supabase = createClient(url, publicKey);
