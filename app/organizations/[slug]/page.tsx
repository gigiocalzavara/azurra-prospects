"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

type Organization = { id: string; name: string; slug: string };

export default function OrganizationWorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [jobs, setJobs] = useState(0);
  const [credits, setCredits] = useState(0);
  const [members, setMembers] = useState(0);
  const [message, setMessage] = useState("Carregando organização...");

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      const { data: selectedOrganization, error } = await supabase
        .from("organizations")
        .select("id,name,slug")
        .eq("slug", slug)
        .maybeSingle();

      if (!active) return;
      if (error || !selectedOrganization) {
        setMessage("Organização não encontrada ou sem permissão de acesso.");
        return;
      }

      const [jobsResult, ledgerResult, membersResult] = await Promise.all([
        supabase.from("prospect_jobs").select("id", { count: "exact", head: true }).eq("organization_id", selectedOrganization.id),
        supabase.from("credit_ledger").select("amount").eq("organization_id", selectedOrganization.id),
        supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", selectedOrganization.id),
      ]);

      if (!active) return;
      setOrganization(selectedOrganization as Organization);
      setJobs(jobsResult.count ?? 0);
      setCredits((ledgerResult.data ?? []).reduce((total, entry) => total + Number(entry.amount), 0));
      setMembers(membersResult.count ?? 0);
      setMessage("");
    }

    void loadWorkspace();
    return () => { active = false; };
  }, [router, slug, supabase]);

  if (!organization) {
    return <main className="auth-shell"><section className="auth-card"><h2>{message}</h2><p><Link href="/admin">Voltar às organizações</Link></p></section></main>;
  }

  return (
    <main className="workspace-shell">
      <div className="workspace-topbar">
        <Link className="workspace-back" href="/admin">← Organizações</Link>
        <div className="eyebrow">AMBIENTE DA ORGANIZAÇÃO</div>
      </div>

      <header className="workspace-hero">
        <h1>{organization.name}</h1>
        <p>Central de operação do Azurra Prospects. A descoberta começa pelo Instagram e evoluirá para WhatsApp e Twitter.</p>
      </header>

      <section className="workspace-metrics" aria-label="Resumo da organização">
        <article className="metric-card"><span>Créditos disponíveis</span><strong>{credits.toLocaleString("pt-BR")}</strong></article>
        <article className="metric-card"><span>Pesquisas criadas</span><strong>{jobs}</strong></article>
        <article className="metric-card"><span>Membros</span><strong>{members}</strong></article>
      </section>

      <section className="module-grid" aria-label="Módulos">
        <article className="module-card"><div className="eyebrow">PRIMEIRO CANAL</div><h2>Instagram</h2><p>Pesquisas, critérios de qualificação e resultados de perfis públicos dentro das regras operacionais.</p><span className="module-status">PRÓXIMA ENTREGA</span></article>
        <article className="module-card"><div className="eyebrow">OPERAÇÃO</div><h2>Pesquisas e prospects</h2><p>Acompanhe execuções, resultados encontrados e o envio selecionado para o Azurra Leads.</p><span className="module-status">EM PREPARAÇÃO</span></article>
        <article className="module-card"><div className="eyebrow">CONTROLE</div><h2>Créditos</h2><p>Saldo derivado do livro-razão, com reservas, consumos, liberações e estornos auditáveis.</p><span className="module-status">FUNDAÇÃO ATIVA</span></article>
        <article className="module-card"><div className="eyebrow">CONFORMIDADE</div><h2>Regras e transparência</h2><p>Rule Registry, shadow mode, origem dos dados e preparação da página de transparência da organização.</p><span className="module-status">SHADOW MODE</span></article>
      </section>
    </main>
  );
}
