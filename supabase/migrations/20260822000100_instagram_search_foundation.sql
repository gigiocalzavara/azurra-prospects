insert into public.rule_registry (rule_key, version, status, definition, checksum)
values (
  'instagram-public-prospecting',
  1,
  'shadow',
  '{"allowed_sources":["public_profile","public_metadata"],"private_content_access":false,"credit_per_requested_result":1,"execution_mode":"shadow"}'::jsonb,
  encode(digest('{"allowed_sources":["public_profile","public_metadata"],"private_content_access":false,"credit_per_requested_result":1,"execution_mode":"shadow"}', 'sha256'), 'hex')
)
on conflict (rule_key, version) do nothing;

create or replace function public.create_instagram_prospect_job(
  target_organization_id uuid,
  search_query text,
  search_location text default null,
  minimum_followers integer default 0,
  maximum_followers integer default null,
  requested_result_limit integer default 100,
  requested_profile_scope text default 'public_only'
)
returns public.prospect_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_job public.prospect_jobs;
  normalized_query text := trim(search_query);
  normalized_location text := nullif(trim(search_location), '');
begin
  if not public.is_organization_member(target_organization_id) then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  if length(normalized_query) < 2 or length(normalized_query) > 120 then
    raise exception 'invalid_search_query' using errcode = '22023';
  end if;

  if minimum_followers < 0 or (maximum_followers is not null and maximum_followers < minimum_followers) then
    raise exception 'invalid_follower_range' using errcode = '22023';
  end if;

  if requested_result_limit < 10 or requested_result_limit > 1000 then
    raise exception 'invalid_result_limit' using errcode = '22023';
  end if;

  if requested_profile_scope not in ('public_only', 'public_metadata') then
    raise exception 'invalid_profile_scope' using errcode = '22023';
  end if;

  insert into public.prospect_jobs (
    organization_id, platform, status, input, rule_key, rule_version, shadow_mode, created_by
  ) values (
    target_organization_id,
    'instagram',
    'queued',
    jsonb_build_object(
      'query', normalized_query,
      'location', normalized_location,
      'min_followers', minimum_followers,
      'max_followers', maximum_followers,
      'result_limit', requested_result_limit,
      'profile_scope', requested_profile_scope,
      'estimated_credits', requested_result_limit
    ),
    'instagram-public-prospecting',
    1,
    true,
    auth.uid()
  ) returning * into created_job;

  insert into public.audit_events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (
    target_organization_id,
    auth.uid(),
    'instagram.search.created',
    'prospect_job',
    created_job.id::text,
    jsonb_build_object('shadow_mode', true, 'estimated_credits', requested_result_limit)
  );

  return created_job;
end;
$$;

revoke all on function public.create_instagram_prospect_job(uuid, text, text, integer, integer, integer, text) from public, anon;
grant execute on function public.create_instagram_prospect_job(uuid, text, text, integer, integer, integer, text) to authenticated;

comment on function public.create_instagram_prospect_job(uuid, text, text, integer, integer, integer, text)
is 'Registra pesquisa Instagram validada em shadow mode, sem coleta externa ou consumo definitivo de creditos.';
