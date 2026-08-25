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
type InstagramOutput = {
  decision?: string;
  execution_mode?: string;
  estimated_results?: number;
  estimated_credits?: number;
  collected_results?: number;
  qualified_results?: number;
  credit_effect?: number;
  executed_at?: string;
};
type ProspectJob = { id: string; status: string; input: InstagramInput; output: InstagramOutput | null; shadow_mode: boolean; created_at: string };
type ProspectResult = {
  id: string;
  job_id: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  is_private: boolean;
  is_verified: boolean;
  public_email: string | null;
  public_phone: string | null;
  public_website: string | null;
  category: string | null;
  location: string | null;
};
type SearchEngineStatus = { configured: boolean; connected: boolean; error?: string };

const statusLabels: Record<string, string> = {
  queued: "Aguardando execução",
  running: "Em processamento",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

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
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [executingJobId, setExecutingJobId] = useState<string | null>(null);
  const [searchEngineStatus, setSearchEngineStatus] = useState<SearchEngineStatus | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [resultsByJob, setResultsByJob] = useState<Record<string, ProspectResult[]>>({});

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
      .select("id,status,input,output,shadow_mode,created_at")
      .eq("organization_id", selectedOrganization.id)
      .eq("platform", "instagram")
      .order("created_at", { ascending: false })
      .limit(10);

    const loadedJobs = (jobData ?? []) as ProspectJob[];
    const jobIds = loadedJobs.map((job) => job.id);
    let resultData: ProspectResult[] = [];
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from("prospect_results")
        .select("id,job_id,username,display_name,profile_url,bio,follower_count,following_count,is_private,is_verified,public_email,public_phone,public_website,category,location")
        .in("job_id", jobIds)
        .order("follower_count", { ascending: false, nullsFirst: false })
        .limit(2500);
      resultData = (data ?? []) as ProspectResult[];
    }

    setOrganization(selectedOrganization as Organization);
    setJobs(loadedJobs);
    setResultsByJob(resultData.reduce<Record<string, ProspectResult[]>>((groups, result) => {
      (groups[result.job_id] ??= []).push(result);
      return groups;
    }, {}));
    setMessage(jobError ? "Não foi possível carregar o histórico." : "");
  }, [router, slug, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadModule(), 0);
    return () => window.clearTimeout(timer);
  }, [loadModule]);

  useEffect(() => {
    let active = true;
    void fetch("/api/system/integrations/search-engine", { cache: "no-store" })
      .then((response) => response.json())
      .then((status: SearchEngineStatus) => { if (active) setSearchEngineStatus(status); })
      .catch(() => { if (active) setSearchEngineStatus({ configured: false, connected: false, error: "unavailable" }); });
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
    setMessage("Pesquisa registrada. Revise a estimativa no histórico antes de executar.");
    await loadModule();
  }

  async function runShadow(jobId: string) {
    setRunningJobId(jobId);
    setMessage("");
    const { error } = await supabase.rpc("run_instagram_shadow_job", { target_job_id: jobId });
    setRunningJobId(null);
    if (error) {
      setMessage(error.code === "PGRST202" ? "A migration do executor ainda precisa ser aplicada no Supabase." : "Não foi possível simular a execução.");
      return;
    }
    setMessage("Execução simulada e auditada. Nenhum dado externo foi coletado e nenhum crédito foi consumido.");
    await loadModule();
  }

  async function executeSearch(job: ProspectJob) {
    const maximumCredits = Math.min(250, job.input.result_limit ?? 100);
    const confirmed = window.confirm(`Executar esta pesquisa agora? O consumo será de 1 crédito por perfil qualificado encontrado, limitado a ${maximumCredits.toLocaleString("pt-BR")} créditos.`);
    if (!confirmed) return;

    setExecutingJobId(job.id);
    setMessage("Executando pesquisa. Isso pode levar alguns minutos...");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setExecutingJobId(null);
      router.replace("/login");
      return;
    }

    try {
      const response = await fetch("/api/instagram/jobs/execute", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const result = await response.json() as { status?: string; error?: string; diagnostic?: string };
      if (!response.ok) throw new Error(result.diagnostic ?? result.error ?? "execution_failed");
      setMessage("Pesquisa iniciada. Acompanhando o processamento...");
      for (let attempt = 0; attempt < 72; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
        const statusResponse = await fetch("/api/instagram/jobs/status", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const statusResult = await statusResponse.json() as { status?: string; resultCount?: number; creditsConsumed?: number; error?: string };
        if (statusResponse.status === 202) {
          setMessage(`Pesquisa em processamento${attempt > 5 ? ". Você pode manter esta página aberta." : "..."}`);
          continue;
        }
        if (!statusResponse.ok) throw new Error(statusResult.error ?? "execution_failed");
        setMessage(`${statusResult.resultCount ?? 0} perfis qualificados encontrados. ${statusResult.creditsConsumed ?? 0} créditos consumidos.`);
        setExpandedJobId(job.id);
        await loadModule();
        return;
      }
      setMessage("A pesquisa continua em processamento. Use Retomar acompanhamento dentro do histórico.");
      await loadModule();
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "execution_failed";
      const explanations: Record<string, string> = {
        search_engine_authentication_failed: "A credencial do motor de busca precisa ser renovada.",
        search_engine_actor_not_found: "O executor de pesquisa configurado não foi encontrado.",
        server_configuration_error: "A configuração interna do servidor está incompleta.",
      };
      setMessage(`${explanations[diagnostic] ?? "Não foi possível iniciar ou concluir a pesquisa."} Nenhum crédito foi consumido. Código: ${diagnostic}.`);
      await loadModule();
    } finally {
      setExecutingJobId(null);
    }
  }

  const organizationHref = `/organizations/${slug}` as Route;

  return (
    <main className="workspace-shell">
      <div className="workspace-topbar">
        <Link className="workspace-back" href={organizationHref}>← {organization?.name ?? "Organização"}</Link>
        <div className="integration-status">
          <span className={searchEngineStatus?.connected ? "integration-dot connected" : "integration-dot"} />
          <span>{searchEngineStatus?.connected ? "MOTOR DE BUSCA CONECTADO" : "MOTOR DE BUSCA INDISPONÍVEL"}</span>
        </div>
      </div>

      <header className="workspace-hero">
        <h1>Nova pesquisa</h1>
        <p>Defina o público que deseja encontrar, revise a estimativa e execute somente quando estiver pronto. O consumo ocorre apenas pelos perfis qualificados encontrados.</p>
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
            <label className="full-field">Quantidade desejada<input type="number" min="10" max="250" step="10" value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))} required /></label>
            <div className="credit-preview"><span>Estimativa máxima</span><strong>{resultLimit.toLocaleString("pt-BR")} créditos</strong></div>
            <div className="policy-note">Perfis privados nunca terão conteúdo restrito acessado. Quando habilitado, o sistema poderá registrar somente nome, usuário, foto e outros metadados que o Instagram exiba publicamente.</div>
            <button className="primary-button full-field" disabled={creating || !organization}>{creating ? "Registrando..." : "Registrar pesquisa"}</button>
          </form>
          {message && <div className="form-message">{message}</div>}
        </div>

        <aside className="history-panel">
          <h2>Pesquisas recentes</h2>
          {jobs.length === 0 && <div className="empty-state">Nenhuma pesquisa registrada nesta organização.</div>}
          {jobs.map((job) => {
            const jobResults = resultsByJob[job.id] ?? [];
            const isSimulation = job.status === "completed" && job.shadow_mode;
            const displayStatus = isSimulation ? "Simulação concluída" : (statusLabels[job.status] ?? job.status);
            const canExecute = searchEngineStatus?.connected && (job.status === "queued" || isSimulation || job.status === "failed" || job.status === "running") && jobResults.length === 0;
            return (
            <article className={`job-card ${expandedJobId === job.id ? "expanded" : ""}`} key={job.id}>
              <button className="job-card-header" type="button" onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)} aria-expanded={expandedJobId === job.id}>
                <span><strong>{job.input.query || "Pesquisa sem título"}</strong><small>{new Date(job.created_at).toLocaleString("pt-BR")}</small></span>
                <span className="job-card-toggle">{expandedJobId === job.id ? "Ocultar" : "Ver detalhes"}</span>
              </button>
              <div className="job-meta"><span>{displayStatus}</span><span>{job.input.result_limit ?? 0} resultados solicitados</span>{jobResults.length > 0 && <span>{jobResults.length} encontrados</span>}</div>
              {expandedJobId === job.id && <div className="job-details">
                <dl>
                  <div><dt>Localização</dt><dd>{job.input.location || "Qualquer localização"}</dd></div>
                  <div><dt>Seguidores</dt><dd>{(job.input.min_followers ?? 0).toLocaleString("pt-BR")} a {job.input.max_followers?.toLocaleString("pt-BR") ?? "sem limite"}</dd></div>
                  <div><dt>Perfis</dt><dd>{job.input.profile_scope === "public_metadata" ? "Públicos e metadados visíveis" : "Somente públicos"}</dd></div>
                  <div><dt>Créditos consumidos</dt><dd>{job.output?.credit_effect ?? 0}</dd></div>
                </dl>
                {isSimulation && <div className="execution-summary"><strong>Simulação concluída</strong><span>Os critérios foram validados, mas nenhum perfil foi coletado e nenhum crédito foi consumido.</span></div>}
                {!job.shadow_mode && job.status === "completed" && <div className="execution-summary"><strong>Pesquisa concluída</strong><span>{jobResults.length} perfis qualificados foram salvos neste histórico.</span></div>}
                {canExecute && <button className="primary-button job-action" onClick={() => void executeSearch(job)} disabled={executingJobId === job.id}>{executingJobId === job.id ? "Acompanhando..." : job.status === "running" ? "Retomar acompanhamento" : "Executar pesquisa"}</button>}
                {job.status === "queued" && <button className="quiet-button job-action" onClick={() => void runShadow(job.id)} disabled={runningJobId === job.id || executingJobId === job.id}>{runningJobId === job.id ? "Simulando..." : "Simular sem coletar"}</button>}
                {jobResults.length > 0 && <div className="prospect-results">
                  <h4>Perfis encontrados</h4>
                  {jobResults.map((result) => <article className="prospect-result" key={result.id}>
                    <div className="prospect-avatar">{(result.display_name || result.username).slice(0, 1).toUpperCase()}</div>
                    <div className="prospect-content">
                      <div className="prospect-heading"><strong>{result.display_name || `@${result.username}`}</strong>{result.is_verified && <span>Verificado</span>}</div>
                      <div className="prospect-username">@{result.username}{result.is_private ? " · Perfil privado" : ""}</div>
                      {result.bio && <p>{result.bio}</p>}
                      <div className="prospect-stats"><span>{result.follower_count?.toLocaleString("pt-BR") ?? "—"} seguidores</span>{result.category && <span>{result.category}</span>}{result.location && <span>{result.location}</span>}</div>
                      <div className="prospect-links">{result.profile_url && <a href={result.profile_url} target="_blank" rel="noreferrer">Abrir Instagram</a>}{result.public_website && <a href={result.public_website} target="_blank" rel="noreferrer">Site público</a>}{result.public_email && <span>{result.public_email}</span>}{result.public_phone && <span>{result.public_phone}</span>}</div>
                    </div>
                  </article>)}
                </div>}
              </div>}
            </article>
          );})}
        </aside>
      </section>
    </main>
  );
}
