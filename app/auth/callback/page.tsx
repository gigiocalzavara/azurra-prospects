"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = params.get("code");
    const destination = params.get("next") === "/reset-password" ? "/reset-password" : "/admin";
    if (!code) {
      const failureTimer = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(failureTimer);
    }
    const supabase = createBrowserClient();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setFailed(true);
      else router.replace(destination);
    });
  }, [params, router]);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">AZURRA PROSPECTS</div>
        <h1>{failed ? "Link inválido ou expirado" : "Validando acesso..."}</h1>
        {failed && <p>Solicite um novo link em <Link href="/forgot-password">Esqueci minha senha</Link>.</p>}
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><section className="auth-card"><h1>Validando acesso...</h1></section></main>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
