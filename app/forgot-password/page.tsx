"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const supabase = createBrowserClient();
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    setMessage(error
      ? "Não foi possível enviar o link agora. Tente novamente em instantes."
      : "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">AZURRA PROSPECTS</div>
        <h1>Recuperar acesso</h1>
        <p>Informe seu e-mail para criar uma nova senha.</p>
        <form onSubmit={requestReset}>
          <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {message && <div className="form-message">{message}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</button>
        </form>
        <p><Link href="/login">Voltar ao login</Link></p>
      </section>
    </main>
  );
}
