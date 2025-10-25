import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Helpers for creating Supabase clients on the server.
 * This file normalizes several environment variable aliases used across setups.
 */

export function shouldUseSupabase(): boolean {
  return process.env.NEXT_PUBLIC_USE_SUPABASE_TABLES === "true"
}

export function isTableNotFoundError(error: any): boolean {
  return error?.code === "42P01" || error?.message?.includes("does not exist")
}

export function markTablesAsNonExistent(): void {
  // no-op for now; could cache missing-table state
}

/**
 * Create a Supabase server-side client if env is configured.
 * Returns the client or null when the environment is not set up.
 */
export function createServerClient() {
  if (!shouldUseSupabase()) return null

  // Support multiple env var naming conventions used in different deployments
  const supabaseUrl =
    process.env.SUPABASE_SUPABASE_NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL

  const supabaseAnonKey =
    process.env.SUPABASE_NEXT_PUBLIC_SUPABASE_ANON_KEY_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[v0] Supabase environment variables not configured: skipping Supabase client creation")
    return null
  }

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async getAll() {
        const cookieStore = await cookies()
        return cookieStore.getAll()
      },
      async setAll(cookiesToSet) {
        try {
          const cookieStore = await cookies()
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // setAll may be called from places where cookies cannot be set (Server Components)
        }
      },
    },
  })
}

/**
 * Create a client intended for server actions where cookies are available.
 * Throws when required env vars are missing to make failures explicit.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not configured")
  }

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // ignore when called in contexts without writable cookies
        }
      },
    },
  })
}
