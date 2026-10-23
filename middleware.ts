import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// Routing: no session -> /login · session, world confirmed missing -> /welcome (recovery page, creates nothing)
// · session + world -> /world/home · membership lookup FAILED -> never treated as "no world" or as access (see below).
// Fails closed: any auth failure is treated as "not signed in"; any lookup failure never reaches world content.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Authenticated pages must never be stored by the browser/bfcache/CDN (Back button after sign-out).
  const sealed = (r: NextResponse) => { r.headers.set("Cache-Control", "private, no-store"); return r; };
  const go = (to: string) => {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // keep refreshed session cookies
    return sealed(redirect);
  };

  const { data: { user } } = await supabase.auth.getUser(); // verified with the Auth server, not just the cookie
  const path = request.nextUrl.pathname;
  if (!user) return path === "/login" ? sealed(response) : go("/login");
  if (path === "/login") return go("/world/home");

  // RLS returns only a world this user belongs to. `error` (network/database failure) is NOT the same as "no row".
  const { data: world, error } = await supabase.from("couple_worlds").select("id").limit(1).maybeSingle();
  if (error) return path === "/welcome" ? sealed(response) : go("/welcome"); // /welcome re-checks and shows a retryable error
  if (path.startsWith("/world") && !world) return go("/welcome");
  if (path === "/welcome" && world) return go("/world/home");
  return sealed(response);
}
export const config = { matcher: ["/world/:path*", "/welcome", "/login"] };
