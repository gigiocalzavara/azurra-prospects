insert into public.rule_registry (rule_key, version, status, definition, checksum)
values (
  'instagram.public-profile.discovery',
  1,
  'shadow',
  '{"scope":"public_profiles_only","private_profiles":"metadata_only","contact_extraction":false,"rate_policy":"conservative"}'::jsonb,
  encode(digest('{"scope":"public_profiles_only","private_profiles":"metadata_only","contact_extraction":false,"rate_policy":"conservative"}', 'sha256'), 'hex')
)
on conflict (rule_key, version) do nothing;
