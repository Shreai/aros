import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const centralIdentityOnly = import.meta.env.VITE_AUTH_MODE === "central";

if ((!supabaseUrl || !supabaseAnonKey) && !centralIdentityOnly) {
  console.error(
    "[AROS] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. " +
    "Ensure .env is at the monorepo root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set.",
  );
}

export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1",
  supabaseAnonKey || "central-identity-build-does-not-use-supabase",
);
