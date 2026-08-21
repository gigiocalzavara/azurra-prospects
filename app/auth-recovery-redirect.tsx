"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export function AuthRecoveryRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    const supabase = createBrowserClient();
    if (code) {
      void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/forgot-password" : "/reset-password");
      });
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) router.replace("/reset-password");
    });
    return () => data.subscription.unsubscribe();
  }, [params, router]);

  return null;
}
