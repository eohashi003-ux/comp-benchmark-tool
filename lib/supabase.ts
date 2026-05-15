import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://pwthtcvfqhoapyevkady.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dGh0Y3ZmcWhvYXB5ZXZrYWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzA1MTMsImV4cCI6MjA5NDI0NjUxM30.xMC0MKOIsdiksgE6cNdThi9w1Gtyu9WJ9S0Sre02KNA";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase config");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);