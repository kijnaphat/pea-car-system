create table if not exists public.trip_anomaly_reviews (
  id uuid primary key default gen_random_uuid(),
  trip_log_id bigint not null references public.trip_logs(id) on delete restrict,
  issue_fingerprint text not null,
  note text not null default 'ตรวจสอบแล้ว ข้อมูลถูกต้อง',
  reviewed_by uuid,
  reviewed_at timestamptz not null default now(),
  constraint trip_anomaly_reviews_fingerprint_present
    check (char_length(issue_fingerprint) between 1 and 2000),
  constraint trip_anomaly_reviews_note_present
    check (char_length(btrim(note)) >= 3),
  constraint trip_anomaly_reviews_trip_fingerprint_unique
    unique (trip_log_id, issue_fingerprint)
);

create index if not exists trip_anomaly_reviews_reviewed_at_idx
  on public.trip_anomaly_reviews (reviewed_at desc);

alter table public.trip_anomaly_reviews enable row level security;

drop policy if exists "admin_read_trip_anomaly_reviews" on public.trip_anomaly_reviews;
create policy "admin_read_trip_anomaly_reviews"
on public.trip_anomaly_reviews
for select
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

revoke all on table public.trip_anomaly_reviews from public, anon, authenticated;
grant select on table public.trip_anomaly_reviews to authenticated;

create or replace function public.admin_acknowledge_trip_anomaly(
  p_trip_log_id bigint,
  p_issue_fingerprint text,
  p_note text default 'ตรวจสอบแล้ว ข้อมูลถูกต้อง'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review_id uuid;
  v_reviewed_at timestamptz;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if p_issue_fingerprint is null
     or char_length(p_issue_fingerprint) < 1
     or char_length(p_issue_fingerprint) > 2000 then
    raise exception 'ข้อมูลอ้างอิงความผิดปกติไม่ถูกต้อง' using errcode = '22023';
  end if;

  if p_note is null or char_length(btrim(p_note)) < 3 then
    raise exception 'กรุณาระบุผลการตรวจสอบอย่างน้อย 3 ตัวอักษร' using errcode = '22023';
  end if;

  if not exists (select 1 from public.trip_logs where id = p_trip_log_id) then
    raise exception 'ไม่พบรายการเดินทางที่ต้องการตรวจสอบ' using errcode = 'P0002';
  end if;

  insert into public.trip_anomaly_reviews (
    trip_log_id,
    issue_fingerprint,
    note,
    reviewed_by
  ) values (
    p_trip_log_id,
    p_issue_fingerprint,
    btrim(p_note),
    (select auth.uid())
  )
  on conflict (trip_log_id, issue_fingerprint) do nothing
  returning id, reviewed_at into v_review_id, v_reviewed_at;

  if v_review_id is null then
    select id, reviewed_at
    into v_review_id, v_reviewed_at
    from public.trip_anomaly_reviews
    where trip_log_id = p_trip_log_id
      and issue_fingerprint = p_issue_fingerprint;
  end if;

  return jsonb_build_object(
    'id', v_review_id,
    'trip_log_id', p_trip_log_id,
    'reviewed_at', v_reviewed_at
  );
end;
$$;

revoke all on function public.admin_acknowledge_trip_anomaly(bigint, text, text)
  from public, anon;
grant execute on function public.admin_acknowledge_trip_anomaly(bigint, text, text)
  to authenticated;
