import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://YOUR_PROJECT.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "YOUR_ANON_KEY";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase config");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);