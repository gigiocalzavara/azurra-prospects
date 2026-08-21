create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.platform_admins enable row level security;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins a
    where a.user_id = auth.uid()
  );
$$;

create policy "platform admins read own grant"
  on public.platform_admins for select
  using (user_id = auth.uid());

create policy "platform admins read organizations"
  on public.organizations for select
  using (public.is_platform_admin());

create policy "platform admins read memberships"
  on public.organization_members for select
  using (public.is_platform_admin());

create function public.admin_list_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  member_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;

  return query
  select o.id, o.name, o.slug, o.created_at, count(m.user_id)
  from public.organizations o
  left join public.organization_members m on m.organization_id = o.id
  group by o.id, o.name, o.slug, o.created_at
  order by o.created_at asc;
end;
$$;

create function public.admin_create_organization(organization_name text, organization_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_organization public.organizations;
  normalized_slug text;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;

  normalized_slug := lower(trim(organization_slug));

  if length(trim(organization_name)) < 2 then
    raise exception 'organization_name_too_short' using errcode = '22023';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_organization_slug' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug)
  values (trim(organization_name), normalized_slug)
  returning * into created_organization;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization.id, auth.uid(), 'owner');

  insert into public.audit_events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (
    created_organization.id,
    auth.uid(),
    'organization.created',
    'organization',
    created_organization.id::text,
    jsonb_build_object('name', created_organization.name, 'slug', created_organization.slug)
  );

  return created_organization;
end;
$$;

revoke all on function public.admin_list_organizations() from public, anon;
revoke all on function public.admin_create_organization(text, text) from public, anon;
grant execute on function public.admin_list_organizations() to authenticated;
grant execute on function public.admin_create_organization(text, text) to authenticated;

insert into public.organizations (name, slug)
values ('Azurra', 'azurra')
on conflict (slug) do update set name = excluded.name;

comment on table public.platform_admins is 'Permissoes globais da plataforma, independentes dos papeis internos de cada organizacao.';
