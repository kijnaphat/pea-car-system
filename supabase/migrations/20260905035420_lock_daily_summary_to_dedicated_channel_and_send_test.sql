create or replace function private.resolve_discord_audit_delivery_channel(p_channel_key text)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select candidate.channel_key
  from (
    select c.channel_key, 1 as priority
    from private.discord_audit_channels c
    where c.channel_key = p_channel_key
      and c.enabled
      and c.webhook_secret_id is not null

    union all

    select c.channel_key, 2 as priority
    from private.discord_audit_channels c
    where p_channel_key <> 'daily_summary'
      and c.channel_key = private.discord_audit_parent_channel(p_channel_key)
      and c.channel_key <> p_channel_key
      and c.enabled
      and c.webhook_secret_id is not null

    union all

    select c.channel_key, 3 as priority
    from private.discord_audit_channels c
    where p_channel_key <> 'daily_summary'
      and c.channel_key = 'all'
      and p_channel_key <> 'all'
      and private.discord_audit_parent_channel(p_channel_key) <> 'all'
      and c.enabled
      and c.webhook_secret_id is not null
  ) candidate
  order by candidate.priority
  limit 1;
$$;

revoke all on function private.resolve_discord_audit_delivery_channel(text)
  from public, anon, authenticated;

comment on function private.resolve_discord_audit_delivery_channel(text) is
  'Resolves a Discord delivery channel. daily_summary is dedicated-only and never falls back to another webhook.';
