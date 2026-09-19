"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const fallbackUrl = "https://laayrkwqvdwucwaipnma.supabase.co";
const fallbackPublishableKey = "sb_publishable_4sqw95OQJbLpy-ioX8q1_Q_kXMqo8vw";

let client: SupabaseClient | null = null;

export function supabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    fallbackPublishableKey;
  client = createClient(url, key);
  return client;
}
