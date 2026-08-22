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
    const destination: "/reset-password" | "/admin" = params.get("next") === "/reset-password" ? "/reset-password" : "/admin";
    const supabase = createBrowserClient();
    let completed = false;

    const finish = (target: "/reset-password" | "/admin") => {
      if (completed) return;
      completed = true;
      router.replace(target);
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      finish(event === "PASSWORD_RECOVERY" ? "/reset-password" : destination);
    });

    if (code) {
      void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setFailed(true);
        else finish(destination);
      });
    } else {
      void supabase.auth.getSession().then(({ data: sessionData, error }) => {
        if (sessionData.session) finish(destination);
        else if (error) setFailed(true);
      });
    }

    const failureTimer = window.setTimeout(() => {
      if (!completed) setFailed(true);
    }, 5000);

    return () => {
      window.clearTimeout(failureTimer);
      data.subscription.unsubscribe();
    };
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
