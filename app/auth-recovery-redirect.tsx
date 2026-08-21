"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export function AuthRecoveryRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    if (!code) return;
    const supabase = createBrowserClient();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      router.replace(error ? "/forgot-password" : "/reset-password");
    });
  }, [params, router]);

  return null;
}
