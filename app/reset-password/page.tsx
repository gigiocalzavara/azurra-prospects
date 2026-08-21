"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage("Não foi possível atualizar a senha. Solicite um novo link.");
      return;
    }
    router.replace("/admin");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">AZURRA PROSPECTS</div>
        <h1>Crie sua nova senha</h1>
        <p>Use pelo menos 8 caracteres.</p>
        <form onSubmit={updatePassword}>
          <label>Nova senha<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <label>Confirmar senha<input type="password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required /></label>
          {message && <div className="form-message error">{message}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
        </form>
      </section>
    </main>
  );
}
