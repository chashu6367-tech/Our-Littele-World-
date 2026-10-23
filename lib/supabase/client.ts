import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
/** Browser client. Uses only the publishable key; every request is bound by RLS. */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
