"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

type Organization = { id: string; name: string; slug: string; created_at: string; member_count: number };

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("Carregando...");
  const [creating, setCreating] = useState(false);

  const loadOrganizations = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }
    const { data, error } = await supabase.rpc("admin_list_organizations");
    if (error) {
      setMessage("Seu usuário não possui acesso de superadmin.");
      return;
    }
    setOrganizations((data ?? []) as Organization[]);
    setMessage("");
  }, [router, supabase]);

  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const { error } = await supabase.rpc("admin_create_organization", {
      organization_name: name,
      organization_slug: slug,
    });
    setCreating(false);
    if (error) {
      setMessage(error.code === "23505" ? "Esse identificador já está em uso." : "Não foi possível criar a organização.");
      return;
    }
    setName("");
    setSlug("");
    await loadOrganizations();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><div className="eyebrow">SUPERADMIN</div><h1>Organizações</h1></div>
        <button className="quiet-button" onClick={signOut}>Sair</button>
      </header>
      <section className="admin-grid">
        <div className="organization-list">
          <div className="section-heading"><h2>Contas da plataforma</h2><span>{organizations.length}</span></div>
          {organizations.map((organization) => (
            <article className="organization-card" key={organization.id}>
              <div><h3>{organization.name}</h3><p>/{organization.slug}</p></div>
              <div className="member-count">{organization.member_count} membro(s)</div>
            </article>
          ))}
          {message && <div className="form-message">{message}</div>}
        </div>
        <aside className="create-panel">
          <h2>Nova organização</h2>
          <p>Crie uma conta isolada e torne-se owner inicial.</p>
          <form onSubmit={createOrganization}>
            <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required /></label>
            <label>Identificador<input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="empresa-exemplo" required /></label>
            <button className="primary-button" disabled={creating}>{creating ? "Criando..." : "Criar organização"}</button>
          </form>
        </aside>
      </section>
    </main>
  );
}
