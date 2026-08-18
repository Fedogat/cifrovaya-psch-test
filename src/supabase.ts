import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://hbhyckuhhkoldaruwtfy.supabase.co";
const fallbackKey = "sb_publishable_J0mQvn9sotsg28Mey6DVvQ_hnB2P105";

export const supabase = createClient(
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fallbackUrl,
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || fallbackKey,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
