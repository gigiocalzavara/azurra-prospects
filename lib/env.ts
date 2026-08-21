import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CLOCK_ENGINE_MODE: z.enum(["shadow", "active"]).default("shadow"),
});

export function getServerEnv() {
  return serverSchema.parse(process.env);
}
