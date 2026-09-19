/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Workspace={id:string;name:string};
type Profile={id:string;platform:string;username:string;followers_count:number;avg_views:number;engagement_rate:number;status:string};
type Content={id:string;platform:string;caption:string|null;hook:string|null;views:number;likes:number;comments:number;viral_score:number;monitored_profiles?:{username?:string}|null};

const tabs=[["overview","Visão geral"],["radar","Radar Viral"],["monitor","Monitoramento"],["library","Biblioteca"],["ai","IA de Conteúdo"]] as const;

export default function Dashboard(){
  const router=useRouter();
  const [tab,setTab]=useState<(typeof tabs)[number][0]>("overview");
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [contents,setContents]=useState<Content[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [platform,setPlatform]=useState("instagram");
  const [username,setUsername]=useState("");
  const [notice,setNotice]=useState("");
  const [aiInput,setAiInput]=useState("");
  const [aiTask,setAiTask]=useState("viral_reason");
  const [aiOutput,setAiOutput]=useState("");
  const [aiBusy,setAiBusy]=useState(false);
  const [collectorStatus,setCollectorStatus]=useState("checking");

  async function load(){
    const client=supabase();
    const {data:userData}=await client.auth.getUser();
    if(!userData.user){router.replace("/login");return}
    const {data:membership}=await client.from("workspace_members").select("workspace_id,workspaces(id,name)").eq("user_id",userData.user.id).limit(1).maybeSingle();
    const raw=membership?.workspaces as unknown;
    const ws=Array.isArray(raw)?raw[0]:raw;
    if(!ws||typeof ws!=="object"||!("id" in ws)){setLoading(false);return}
    const selected=ws as Workspace; setWorkspace(selected);
    const [p,c]=await Promise.all([
      client.from("monitored_profiles").select("*").eq("workspace_id",selected.id).order("created_at",{ascending:false}),
      client.from("content_items").select("*,monitored_profiles(username)").eq("workspace_id",selected.id).order("viral_score",{ascending:false}).limit(100)
    ]);
    setProfiles((p.data||[]) as Profile[]); setContents((c.data||[]) as Content[]); setLoading(false);
  }
  useEffect(()=>{load()},[]);
  useEffect(()=>{
    fetch("/api/collect/status")
      .then(r=>r.json())
      .then(data=>setCollectorStatus(data?.status||"offline"))
      .catch(()=>setCollectorStatus("offline"));
  },[]);

  const filtered=useMemo(()=>{const q=query.toLowerCase().trim();if(!q)return contents;return contents.filter(i=>[i.caption,i.hook,i.platform,i.monitored_profiles?.username].filter(Boolean).join(" ").toLowerCase().includes(q))},[contents,query]);
  const views=contents.reduce((s,i)=>s+Number(i.views||0),0);
  const avg=contents.length?contents.reduce((s,i)=>s+Number(i.viral_score||0),0)/contents.length:0;

  async function collectProfile(profile:Profile){
    if(!workspace||profile.platform!=="instagram")return;
    setNotice(`Coletando posts de @${profile.username}...`);
    const response=await fetch("/api/collect/instagram",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username:profile.username,limit:24})
    });
    const data=await response.json();
    if(!response.ok){
      setNotice(data?.error||"Não foi possível coletar o perfil.");
      return;
    }

    const rows=(data.items||[]).map((item:Record<string,unknown>)=>({
      ...item,
      workspace_id:workspace.id,
      monitored_profile_id:profile.id,
      platform:"instagram"
    }));

    if(rows.length){
      const {error}=await supabase().from("content_items").upsert(rows,{onConflict:"workspace_id,platform,external_id"});
      if(error){setNotice(error.message);return}
    }

    await supabase().from("monitored_profiles").update({
      avg_views:Number(data.avg_views||0),
      engagement_rate:Number(data.engagement_rate||0),
      last_collected_at:new Date().toISOString(),
      status:"active"
    }).eq("id",profile.id);

    setNotice(`${data.count||0} conteúdos coletados de @${profile.username}.`);
    await load();
  }

  async function addProfile(e:FormEvent){
    e.preventDefault(); if(!workspace)return;
    const u=username.trim().replace(/^@/,""); if(!u)return;
    const base=platform==="instagram"?"https://instagram.com/":platform==="tiktok"?"https://tiktok.com/@":"https://youtube.com/@";
    const {data:profile,error}=await supabase().from("monitored_profiles")
      .upsert({workspace_id:workspace.id,platform,username:u,profile_url:base+u},{onConflict:"workspace_id,platform,username"})
      .select("*").single();
    if(error){setNotice(error.message);return}
    setUsername("");
    setNotice("Perfil adicionado ao monitoramento.");
    if(platform==="instagram"&&profile) await collectProfile(profile as Profile);
    else await load();
  }

  async function analyze(){
    if(!aiInput.trim())return;
    setAiBusy(true); setAiOutput("");
    const res=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:aiInput,task:aiTask})});
    const data=await res.json(); setAiOutput(data.text||data.error||"Sem resposta."); setAiBusy(false);
  }

  async function signOut(){await supabase().auth.signOut();router.replace("/login")}
  if(loading)return <main className="loading-screen"><div className="pulse-logo">A</div><p>Carregando radar...</p></main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark">A</span><span>AZURRA <b>VIRAL</b></span></div>
      <nav>{tabs.map(([key,label])=><button key={key} className={tab===key?"nav-item active":"nav-item"} onClick={()=>setTab(key)}>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-chip"><span>Workspace</span><b>{workspace?.name||"Azurra Viral"}</b></div><button className="nav-item" onClick={signOut}>Sair</button></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div><span className="eyebrow">AZURRA VIRAL</span><h1>{tabs.find(t=>t[0]===tab)?.[1]}</h1></div><div className="status-pill"><span/>{collectorStatus==="online"?"Coletor conectado":collectorStatus==="missing"?"Coletor sem chave":"Coletor offline"}</div></header>

      {tab==="overview"&&<div className="content-area">
        <section className="welcome-banner"><div><span className="eyebrow">INTELIGÊNCIA CRIATIVA</span><h2>Encontre sinais. Transforme em conteúdo.</h2><p>Monitore referências e destaque o que estiver fora da curva.</p></div><button className="primary-button compact" onClick={()=>setTab("monitor")}>+ Monitorar perfil</button></section>
        <section className="stat-grid"><Stat label="Perfis monitorados" value={String(profiles.length)}/><Stat label="Conteúdos no radar" value={String(contents.length)}/><Stat label="Views mapeadas" value={format(views)}/><Stat label="Viral Score médio" value={avg.toFixed(1)}/></section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">TOP CONTEÚDOS</span><h3>O que está puxando atenção</h3></div></div><ContentList items={contents.slice(0,8)} onAnalyze={i=>{setAiInput(i.caption||i.hook||"");setTab("ai")}}/></section>
      </div>}

      {tab==="radar"&&<div className="content-area"><section className="search-hero"><span className="eyebrow">RADAR VIRAL</span><h2>Busque dentro do que você monitora.</h2><input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Assunto, hook, perfil ou plataforma..." /></section><ContentGrid items={filtered} onAnalyze={i=>{setAiInput(i.caption||i.hook||"");setTab("ai")}}/></div>}

      {tab==="monitor"&&<div className="content-area two-columns">
        <section className="panel"><span className="eyebrow">NOVO PERFIL</span><h3>Adicionar monitoramento</h3><form className="stack-form" onSubmit={addProfile}><label>Plataforma<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label><label>Usuário<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@perfil" /></label>{notice&&<div className="form-message">{notice}</div>}<button className="primary-button">Adicionar perfil</button></form></section>
        <section className="panel"><div className="panel-head"><h3>{profiles.length} perfis</h3></div>{profiles.length===0?<Empty/>:<div className="profile-list">{profiles.map(p=><article className="profile-row" key={p.id}><div className="avatar-fallback">{p.username.slice(0,2).toUpperCase()}</div><div className="grow"><b>@{p.username}</b><span>{p.platform}</span></div><Metric value={format(p.followers_count)} label="seguidores"/><Metric value={format(p.avg_views)} label="views média"/><span className="mini-status">{p.status}</span>{p.platform==="instagram"&&<button className="ghost-button small" onClick={()=>collectProfile(p)}>Atualizar dados</button>}</article>)}</div>}</section>
      </div>}

      {tab==="library"&&<div className="content-area"><section className="panel"><span className="eyebrow">BIBLIOTECA</span><h3>Referências encontradas</h3><ContentGrid items={contents} onAnalyze={i=>{setAiInput(i.caption||i.hook||"");setTab("ai")}}/></section></div>}

      {tab==="ai"&&<div className="content-area ai-layout"><section className="panel"><span className="eyebrow">IA DE CONTEÚDO</span><h3>Transforme referência em ideia</h3><select value={aiTask} onChange={e=>setAiTask(e.target.value)}><option value="viral_reason">Por que isso funciona?</option><option value="hook">Criar hooks</option><option value="script">Criar roteiro</option><option value="angles">Novos ângulos</option></select><textarea className="ai-textarea" value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Cole aqui o conteúdo..."/><button className="primary-button" onClick={analyze} disabled={aiBusy}>{aiBusy?"Analisando...":"✦ Analisar com IA"}</button></section><section className="panel ai-result"><span className="eyebrow">RESULTADO</span>{aiOutput?<pre>{aiOutput}</pre>:<Empty/>}</section></div>}
    </section>
  </main>
}
function Stat({label,value}:{label:string;value:string}){return <article className="stat-card"><span>{label}</span><strong>{value}</strong></article>}
function Metric({value,label}:{value:string;label:string}){return <div className="metric"><b>{value}</b><span>{label}</span></div>}
function Empty(){return <div className="empty"><b>O radar ainda está vazio.</b><span>Adicione perfis e conteúdos coletados aparecerão aqui.</span></div>}
function ContentList({items,onAnalyze}:{items:Content[];onAnalyze:(i:Content)=>void}){if(!items.length)return <Empty/>;return <div>{items.map((i,n)=><article className="content-row" key={i.id}><span className="rank">{String(n+1).padStart(2,"0")}</span><div className="grow"><b>{i.hook||i.caption?.slice(0,90)||"Conteúdo"}</b><span>@{i.monitored_profiles?.username||"perfil"} · {i.platform}</span></div><Metric value={format(i.views)} label="views"/><Metric value={Number(i.viral_score).toFixed(0)} label="viral score"/><button className="ghost-button small" onClick={()=>onAnalyze(i)}>IA</button></article>)}</div>}
function ContentGrid({items,onAnalyze}:{items:Content[];onAnalyze:(i:Content)=>void}){if(!items.length)return <Empty/>;return <div className="cards-grid">{items.map(i=><article className="viral-card" key={i.id}><div className="score">{Number(i.viral_score).toFixed(0)}</div><span className="eyebrow">{i.platform}</span><h4>{i.hook||i.caption?.slice(0,120)||"Conteúdo monitorado"}</h4><p>@{i.monitored_profiles?.username||"perfil"}</p><div className="card-metrics">▶ {format(i.views)} · ♥ {format(i.likes)} · ◌ {format(i.comments)}</div><button className="ghost-button" onClick={()=>onAnalyze(i)}>✦ Analisar com IA</button></article>)}</div>}
function format(v:number){const n=Number(v||0);return n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"k":String(n)}
