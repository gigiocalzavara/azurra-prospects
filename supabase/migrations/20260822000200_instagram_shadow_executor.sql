alter table public.prospect_jobs
  add column if not exists output jsonb;

create table if not exists public.prospect_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.prospect_jobs(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'whatsapp', 'twitter')),
  external_id text,
  username text not null,
  display_name text,
  profile_url text,
  avatar_url text,
  bio text,
  follower_count bigint,
  following_count bigint,
  is_private boolean not null default false,
  is_verified boolean not null default false,
  public_email text,
  public_phone text,
  public_website text,
  category text,
  location text,
  source_metadata jsonb not null default '{}'::jsonb,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, username)
);

create index if not exists prospect_results_org_created_idx
  on public.prospect_results(organization_id, created_at desc);

alter table public.prospect_results enable row level security;

drop policy if exists "members read prospect results" on public.prospect_results;
create policy "members read prospect results"
  on public.prospect_results for select
  using (public.is_organization_member(organization_id));

create or replace function public.run_instagram_shadow_job(target_job_id uuid)
returns public.prospect_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_job public.prospect_jobs;
  completed_job public.prospect_jobs;
  active_rule public.rule_registry;
  requested_results integer;
begin
  select * into selected_job
  from public.prospect_jobs
  where id = target_job_id
  for update;

  if selected_job.id is null then
    raise exception 'prospect_job_not_found' using errcode = 'P0002';
  end if;

  if not public.is_organization_member(selected_job.organization_id) then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  if selected_job.platform <> 'instagram' or not selected_job.shadow_mode then
    raise exception 'instagram_shadow_job_required' using errcode = '22023';
  end if;

  if selected_job.status <> 'queued' then
    raise exception 'prospect_job_not_queued' using errcode = '55000';
  end if;

  select * into active_rule
  from public.rule_registry
  where rule_key = selected_job.rule_key
    and version = selected_job.rule_version;

  if active_rule.id is null or active_rule.status not in ('shadow', 'active') then
    raise exception 'operational_rule_unavailable' using errcode = '55000';
  end if;

  requested_results := greatest(10, least(1000, coalesce((selected_job.input->>'result_limit')::integer, 100)));

  update public.prospect_jobs
  set status = 'running', started_at = now()
  where id = selected_job.id;

  update public.prospect_jobs
  set
    status = 'completed',
    finished_at = now(),
    output = jsonb_build_object(
      'execution_mode', 'shadow',
      'decision', 'allowed',
      'provider', 'adapter_pending',
      'estimated_results', requested_results,
      'estimated_credits', requested_results,
      'credit_effect', 0,
      'criteria', selected_job.input,
      'private_content_access', false,
      'planned_steps', jsonb_build_array('provider_search', 'normalize', 'apply_rules', 'deduplicate', 'persist_results', 'settle_credits'),
      'executed_at', now()
    )
  where id = selected_job.id
  returning * into completed_job;

  insert into public.audit_events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (
    selected_job.organization_id,
    auth.uid(),
    'instagram.shadow.completed',
    'prospect_job',
    selected_job.id::text,
    jsonb_build_object(
      'rule_key', selected_job.rule_key,
      'rule_version', selected_job.rule_version,
      'estimated_results', requested_results,
      'estimated_credits', requested_results,
      'credit_effect', 0,
      'provider', 'adapter_pending'
    )
  );

  return completed_job;
end;
$$;

revoke all on function public.run_instagram_shadow_job(uuid) from public, anon;
grant execute on function public.run_instagram_shadow_job(uuid) to authenticated;

comment on table public.prospect_results is 'Resultados normalizados por canal; somente dados publicos e evidencias permitidas podem ser persistidos.';
comment on function public.run_instagram_shadow_job(uuid) is 'Valida e conclui o plano de uma pesquisa Instagram em shadow mode sem coleta externa ou consumo de creditos.';
