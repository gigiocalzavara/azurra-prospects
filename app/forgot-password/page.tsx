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
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (!error) {
      setMessage("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
      return;
    }

    const errorCode = error.code || "unknown_error";
    const messages: Record<string, string> = {
      over_email_send_rate_limit: "O limite temporário de e-mails do Supabase foi atingido. Aguarde e tente novamente mais tarde.",
      email_address_invalid: "O endereço de e-mail informado não é válido.",
      email_not_confirmed: "Este e-mail ainda não foi confirmado no Supabase.",
      request_timeout: "O Supabase demorou para responder. Tente novamente em instantes.",
      unexpected_failure: "O serviço de e-mail do Supabase não está configurado corretamente.",
    };
    setMessage(`${messages[errorCode] || "O Supabase recusou o envio do link."} Código: ${errorCode}.`);
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
