create extension if not exists pgcrypto;

create type public.rule_status as enum ('draft', 'shadow', 'active', 'retired');
create type public.job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
create type public.credit_entry_type as enum ('grant', 'reserve', 'consume', 'release', 'refund', 'expire', 'adjustment');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.rule_registry (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  version integer not null check (version > 0),
  status public.rule_status not null default 'draft',
  definition jsonb not null,
  checksum text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (rule_key, version)
);

create unique index rule_registry_one_active
  on public.rule_registry(rule_key)
  where status = 'active';

create table public.prospect_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'whatsapp', 'twitter')),
  status public.job_status not null default 'queued',
  input jsonb not null,
  rule_key text not null,
  rule_version integer not null,
  shadow_mode boolean not null default true,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index prospect_jobs_due_idx
  on public.prospect_jobs(status, scheduled_at);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.prospect_jobs(id),
  entry_type public.credit_entry_type not null,
  amount bigint not null check (amount <> 0),
  idempotency_key text not null unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index credit_ledger_org_created_idx
  on public.credit_ledger(organization_id, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  subject_type text not null,
  subject_id text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.rule_registry enable row level security;
alter table public.prospect_jobs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.audit_events enable row level security;

create function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
  );
$$;

create policy "members read own organization"
  on public.organizations for select
  using (public.is_organization_member(id));

create policy "members read memberships"
  on public.organization_members for select
  using (public.is_organization_member(organization_id));

create policy "members read jobs"
  on public.prospect_jobs for select
  using (public.is_organization_member(organization_id));

create policy "members read credit ledger"
  on public.credit_ledger for select
  using (public.is_organization_member(organization_id));

create policy "members read audit events"
  on public.audit_events for select
  using (organization_id is not null and public.is_organization_member(organization_id));

comment on table public.rule_registry is 'Registro imutavel e versionado das regras operacionais e de conformidade.';
comment on table public.credit_ledger is 'Livro-razao append-only; saldos sao derivados da soma dos lancamentos.';
