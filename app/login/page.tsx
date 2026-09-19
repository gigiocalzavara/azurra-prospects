"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage(){
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{supabase().auth.getUser().then(({data})=>{if(data.user)router.replace("/dashboard")})},[router]);

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMessage("");
    const client=supabase();
    const result=mode==="login"
      ? await client.auth.signInWithPassword({email,password})
      : await client.auth.signUp({email,password});
    if(result.error) setMessage(result.error.message);
    else if(mode==="login") router.replace("/dashboard");
    else setMessage("Conta criada. Se a confirmação de e-mail estiver ativa, confirme o e-mail antes de entrar.");
    setBusy(false);
  }

  return <main className="auth-shell">
    <section className="auth-brand">
      <div className="brand-lockup"><span className="brand-mark">A</span><span>AZURRA <b>VIRAL</b></span></div>
      <div className="hero-copy"><span className="eyebrow">INTELIGÊNCIA DE CONTEÚDO</span><h1>Descubra o que funciona <em>antes</em> do próximo post.</h1><p>Monitore perfis, encontre conteúdos fora da curva e transforme sinais de performance em novas ideias.</p></div>
    </section>
    <section className="auth-panel"><form className="login-card" onSubmit={submit}>
      <div><span className="eyebrow">ACESSO</span><h2>{mode==="login"?"Entre no radar":"Crie sua conta"}</h2></div>
      <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label>Senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label>
      {message&&<div className="form-message">{message}</div>}
      <button className="primary-button" disabled={busy}>{busy?"Aguarde...":mode==="login"?"Entrar":"Criar conta"}</button>
      <button className="text-button" type="button" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Ainda não tenho conta":"Já tenho uma conta"}</button>
    </form></section>
  </main>;
}
