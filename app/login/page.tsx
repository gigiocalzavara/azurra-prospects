"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos. Se você recebeu um convite e ainda não criou a senha, use ‘Esqueci minha senha’."
        : "Não foi possível entrar agora. Tente novamente em instantes.");
      return;
    }
    router.push("/admin");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">AZURRA PROSPECTS</div>
        <h1>Bem-vindo.</h1>
        <p>Entre para administrar suas organizações e operações.</p>
        <form onSubmit={signIn}>
          <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {message && <div className="form-message error">{message}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        </form>
        <p><Link href="/forgot-password">Esqueci minha senha</Link></p>
      </section>
    </main>
  );
}
