"use client";

import Link from "next/link";
import type { Route } from "next";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

type Organization = { id: string; name: string; slug: string };
type InstagramInput = {
  query?: string;
  location?: string | null;
  min_followers?: number;
  max_followers?: number | null;
  result_limit?: number;
  profile_scope?: string;
};
type ProspectJob = { id: string; status: string; input: InstagramInput; shadow_mode: boolean; created_at: string };
type ApifyStatus = { configured: boolean; connected: boolean; searchActor: string; error?: string };

export default function InstagramPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [jobs, setJobs] = useState<ProspectJob[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minFollowers, setMinFollowers] = useState(0);
  const [maxFollowers, setMaxFollowers] = useState("");
  const [resultLimit, setResultLimit] = useState(100);
  const [profileScope, setProfileScope] = useState("public_only");
  const [message, setMessage] = useState("Carregando...");
  const [creating, setCreating] = useState(false);
  const [apifyStatus, setApifyStatus] = useState<ApifyStatus | null>(null);

  const loadModule = useCallback(async () => {
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

    if (error || !selectedOrganization) {
      setMessage("Organização não encontrada ou sem permissão.");
      return;
    }

    const { data: jobData, error: jobError } = await supabase
      .from("prospect_jobs")
      .select("id,status,input,shadow_mode,created_at")
      .eq("organization_id", selectedOrganization.id)
      .eq("platform", "instagram")
      .order("created_at", { ascending: false })
      .limit(10);

    setOrganization(selectedOrganization as Organization);
    setJobs((jobData ?? []) as ProspectJob[]);
    setMessage(jobError ? "Não foi possível carregar o histórico." : "");
  }, [router, slug, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadModule(), 0);
    return () => window.clearTimeout(timer);
  }, [loadModule]);

  useEffect(() => {
    let active = true;
    void fetch("/api/system/integrations/apify", { cache: "no-store" })
      .then((response) => response.json())
      .then((status: ApifyStatus) => { if (active) setApifyStatus(status); })
      .catch(() => { if (active) setApifyStatus({ configured: false, connected: false, searchActor: "", error: "unavailable" }); });
    return () => { active = false; };
  }, []);

  async function createSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setCreating(true);
    setMessage("");

    const { error } = await supabase.rpc("create_instagram_prospect_job", {
      target_organization_id: organization.id,
      search_query: query,
      search_location: location || null,
      minimum_followers: minFollowers,
      maximum_followers: maxFollowers ? Number(maxFollowers) : null,
      requested_result_limit: resultLimit,
      requested_profile_scope: profileScope,
    });

    setCreating(false);
    if (error) {
      setMessage(error.code === "PGRST202" ? "A atualização do banco para pesquisas ainda precisa ser aplicada." : "Não foi possível criar a pesquisa.");
      return;
    }

    setQuery("");
    setLocation("");
    setMessage("Pesquisa registrada em shadow mode. Nenhum crédito foi consumido.");
    await loadModule();
  }

  const organizationHref = `/organizations/${slug}` as Route;

  return (
    <main className="workspace-shell">
      <div className="workspace-topbar">
        <Link className="workspace-back" href={organizationHref}>← {organization?.name ?? "Organização"}</Link>
        <div className="integration-status">
          <span className={apifyStatus?.connected ? "integration-dot connected" : "integration-dot"} />
          <span>{apifyStatus?.connected ? "APIFY CONECTADA" : "APIFY NÃO CONECTADA"}</span>
        </div>
      </div>

      <header className="workspace-hero">
        <h1>Nova pesquisa</h1>
        <p>Defina o público que deseja encontrar. Nesta etapa, a pesquisa é registrada e auditada em shadow mode, sem iniciar uma execução paga.</p>
      </header>

      <section className="instagram-layout">
        <div className="search-panel">
          <h2>Critérios de prospecção</h2>
          <form className="search-form" onSubmit={createSearch}>
            <label className="full-field">Palavra-chave ou nicho<input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={120} placeholder="Ex.: clínicas de estética" required /></label>
            <label>Localização<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} placeholder="Ex.: João Pessoa, PB" /></label>
            <label>Tipo de perfil<select value={profileScope} onChange={(event) => setProfileScope(event.target.value)}><option value="public_only">Somente públicos</option><option value="public_metadata">Públicos + metadados visíveis de privados</option></select></label>
            <label>Mínimo de seguidores<input type="number" min="0" max="1000000000" value={minFollowers} onChange={(event) => setMinFollowers(Number(event.target.value))} /></label>
            <label>Máximo de seguidores<input type="number" min={Math.max(minFollowers, 1)} max="1000000000" value={maxFollowers} onChange={(event) => setMaxFollowers(event.target.value)} placeholder="Sem limite" /></label>
            <label className="full-field">Quantidade desejada<input type="number" min="10" max="1000" step="10" value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))} required /></label>
            <div className="credit-preview"><span>Estimativa máxima</span><strong>{resultLimit.toLocaleString("pt-BR")} créditos</strong></div>
            <div className="policy-note">Perfis privados nunca terão conteúdo restrito acessado. Quando habilitado, o sistema poderá registrar somente nome, usuário, foto e outros metadados que o Instagram exiba publicamente.</div>
            <button className="primary-button full-field" disabled={creating || !organization}>{creating ? "Registrando..." : "Registrar pesquisa"}</button>
          </form>
          {message && <div className="form-message">{message}</div>}
        </div>

        <aside className="history-panel">
          <h2>Pesquisas recentes</h2>
          {jobs.length === 0 && <div className="empty-state">Nenhuma pesquisa registrada nesta organização.</div>}
          {jobs.map((job) => (
            <article className="job-card" key={job.id}>
              <h3>{job.input.query || "Pesquisa sem título"}</h3>
              <div className="job-meta"><span>{job.status}</span><span>{job.shadow_mode ? "shadow" : "active"}</span><span>{job.input.result_limit ?? 0} resultados</span></div>
            </article>
          ))}
        </aside>
      </section>
    </main>
  );
}
