create or replace function private.process_discord_audit_queue()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_webhook_url text;
  v_event public.audit_events%rowtype;
  v_request_id bigint;
begin
  -- Discord returns the completed webhook response because every request uses
  -- wait=true. Remove an audit row only after Discord confirms a 2xx response.
  delete from public.audit_events e
  using net._http_response r
  where e.delivery_status = 'sending'
    and e.request_id = r.id
    and r.error_msg is null
    and r.status_code between 200 and 299;

  update public.audit_events e
  set delivery_status = case when e.attempt_count >= 5 then 'failed' else 'pending' end,
      next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(mins => least(30, e.attempt_count * 2)),
      last_error = pg_catalog.left(coalesce(r.error_msg, 'Discord HTTP ' || coalesce(r.status_code::text, 'unknown')), 1000),
      request_id = null
  from net._http_response r
  where e.delivery_status = 'sending'
    and e.request_id = r.id
    and (r.error_msg is not null or r.status_code < 200 or r.status_code >= 300);

  update public.audit_events e
  set delivery_status = case when e.attempt_count >= 5 then 'failed' else 'pending' end,
      next_attempt_at = pg_catalog.now() + interval '5 minutes',
      last_error = 'ไม่พบผลตอบกลับภายใน 10 นาที',
      request_id = null
  where e.delivery_status = 'sending'
    and e.last_attempt_at < pg_catalog.now() - interval '10 minutes'
    and not exists (select 1 from net._http_response r where r.id = e.request_id);

  for v_event in
    with ranked as (
      select
        e.id,
        pg_catalog.row_number() over (
          partition by e.delivery_channel_key
          order by e.occurred_at
        ) as channel_rank
      from public.audit_events e
      where e.delivery_status = 'pending'
        and e.delivery_channel_key is not null
        and e.next_attempt_at <= pg_catalog.now()
        and e.attempt_count < 5
    )
    select e.*
    from public.audit_events e
    join ranked r on r.id = e.id
    where r.channel_rank <= 4
    order by e.occurred_at
    limit 24
    for update of e skip locked
  loop
    select ds.decrypted_secret
    into v_webhook_url
    from private.discord_audit_channels c
    join vault.decrypted_secrets ds on ds.id = c.webhook_secret_id
    where c.channel_key = v_event.delivery_channel_key
      and c.enabled;

    if v_webhook_url is null then
      update public.audit_events
      set delivery_status = 'disabled',
          last_error = 'ช่อง Discord ถูกปิดหรือไม่มี Webhook',
          request_id = null
      where id = v_event.id;
      continue;
    end if;

    begin
      v_request_id := net.http_post(
        url := v_webhook_url || case when pg_catalog.strpos(v_webhook_url, '?') > 0 then '&wait=true' else '?wait=true' end,
        body := private.build_discord_audit_payload(v_event),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );

      update public.audit_events
      set delivery_status = 'sending',
          request_id = v_request_id,
          attempt_count = attempt_count + 1,
          last_attempt_at = pg_catalog.now(),
          last_error = null
      where id = v_event.id;
    exception when others then
      update public.audit_events
      set delivery_status = case when attempt_count + 1 >= 5 then 'failed' else 'pending' end,
          attempt_count = attempt_count + 1,
          next_attempt_at = pg_catalog.now() + interval '5 minutes',
          last_attempt_at = pg_catalog.now(),
          last_error = pg_catalog.left(SQLERRM, 1000)
      where id = v_event.id;
    end;
  end loop;
end;
$$;

revoke all on function private.process_discord_audit_queue()
  from public, anon, authenticated;

-- Rows already confirmed before this migration can also be removed. Pending,
-- disabled and failed rows remain available for configuration or retry.
delete from public.audit_events
where delivery_status = 'delivered';
