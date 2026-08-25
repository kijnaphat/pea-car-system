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
  update public.audit_events e
  set delivery_status = 'delivered',
      delivered_at = pg_catalog.now(),
      last_error = null
  from net._http_response r
  where e.delivery_status = 'sending'
    and e.request_id = r.id
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

  select ds.decrypted_secret
  into v_webhook_url
  from private.discord_audit_settings s
  join vault.decrypted_secrets ds on ds.id = s.webhook_secret_id
  where s.id = true and s.enabled = true;

  if v_webhook_url is null then
    return;
  end if;

  for v_event in
    select e.*
    from public.audit_events e
    where e.delivery_status = 'pending'
      and e.next_attempt_at <= pg_catalog.now()
      and e.attempt_count < 5
    order by e.occurred_at
    limit 4
    for update skip locked
  loop
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
