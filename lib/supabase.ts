import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error("Missing Supabase config");
}

export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey
);