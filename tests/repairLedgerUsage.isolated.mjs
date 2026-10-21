// Optional isolated SQL integration runner. It never connects to Supabase.
// Install a pinned @electric-sql/pglite in a temporary directory, then run:
// PGLITE_MODULE=/absolute/node_modules/@electric-sql/pglite/dist/index.js node tests/repairLedgerUsage.isolated.mjs
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = new URL('../', import.meta.url);
const db = new PGlite();
await db.waitReady;
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema private;
  grant usage on schema public,private,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
  $$;
  create table auth.users(id uuid primary key,created_at timestamptz default now());
  create table public.departments(id bigint primary key,name text);
  create table public.staff(id bigint primary key,staff_code text,full_name text,position text,department_id bigint);
  create table public.cars(id bigint primary key,plate_number text,department_id bigint,fuel_type text,status text);
  create table public.trip_logs(id bigint primary key,car_id bigint,start_time timestamptz,is_completed boolean,activity_type text);
  create function public.effective_trip_activity(p_activity_type text,p_fuel_type text)
  returns text language sql immutable as $$
    select coalesce(p_activity_type,case when upper(btrim(coalesce(p_fuel_type,'')))='EV' then 'charge' else 'usage' end);
  $$;
  create table public.car_maintenance_records(id uuid primary key,car_id bigint,reported_at timestamptz,
    completed_at timestamptz,description text,completion_note text,billing_status text,repair_amount numeric,
    status text,y6_trip_log_id bigint);
  create table public.maintenance_repair_items(code text primary key,name text,display_order integer);
  create table public.car_maintenance_repair_items(maintenance_record_id uuid,repair_item_code text,custom_text text);
  insert into public.departments values(1,'isolated test department');
  insert into public.staff values(1,'123456','isolated test staff','test',1);
  insert into public.cars values(1,'TEST-1',1,'diesel','available'),(2,'TEST-EV',1,'EV','available'),
    (3,'TEST-no-use',1,'diesel','available');
  insert into public.trip_logs values
    (101,1,((now() at time zone 'Asia/Bangkok')::date-5)::timestamp at time zone 'Asia/Bangkok',true,null),
    (102,1,(((now() at time zone 'Asia/Bangkok')::date-5)::timestamp at time zone 'Asia/Bangkok')+interval '2 hours',true,'usage'),
    (103,1,((date_trunc('month',now() at time zone 'Asia/Bangkok'))::date-1)::timestamp at time zone 'Asia/Bangkok',true,'usage'),
    (201,2,((now() at time zone 'Asia/Bangkok')::date-1)::timestamp at time zone 'Asia/Bangkok',true,'charge'),
    (202,2,(((now() at time zone 'Asia/Bangkok')::date-1)::timestamp at time zone 'Asia/Bangkok')+interval '2 hours',true,null),
    (203,2,((now() at time zone 'Asia/Bangkok')::date-2)::timestamp at time zone 'Asia/Bangkok',true,'usage'),
    (204,2,((now() at time zone 'Asia/Bangkok')::date-3)::timestamp at time zone 'Asia/Bangkok',false,'usage');
  insert into public.car_maintenance_records values('11111111-1111-4111-8111-111111111111',1,now(),now(),
    'isolated optional user description','isolated completed work','billed',50,'completed',101);
  insert into public.maintenance_repair_items values('other','Other',1);
`);

for (const file of [
  'supabase/migrations/20261018182829_admin_repair_work_ledger.sql',
  'supabase/migrations/20261019044449_staff_repair_work_ledger.sql',
  'supabase/migrations/20261021151931_repair_ledger_usage_date_yp6.sql',
]) {
  await db.exec(await fs.readFile(new URL(file, root), 'utf8'));
  console.log(`Applied isolated prerequisite: ${file}`);
}
await db.exec(await fs.readFile(new URL('tests/repairLedgerUsage.db.sql', root), 'utf8'));
const ev = await db.query(`select public.list_repair_ledger_usage_dates_staff('123456',2,
  (select date_trunc('month',start_time at time zone 'Asia/Bangkok')::date from public.trip_logs where id=203)) as days`);
const days = ev.rows[0].days;
if (days.length !== 1 || days[0].trip_count !== 1) throw new Error('EV charge-only and unfinished trips leaked into allowed usage days');
await db.exec(`
  begin;
  set local role anon;
  do $$ declare v_payload jsonb; v_day date; v_car bigint; begin
    for v_car,v_day in
      values (2,(now() at time zone 'Asia/Bangkok')::date-1),
        (2,(now() at time zone 'Asia/Bangkok')::date-3),
        (3,(now() at time zone 'Asia/Bangkok')::date-5)
    loop
      v_payload:=jsonb_build_object('car_id',v_car,'repair_date',v_day,'usage_date',v_day,
        'plate_number','isolated wrong-day check','repair_description','not a real repair',
        'client_request_id',gen_random_uuid(),'source_type','manual');
      begin perform public.save_repair_work_ledger_staff('123456',v_payload);
        raise exception 'Charge-only/unfinished/wrong-car date accepted';
        exception when invalid_parameter_value then null; end;
    end loop;
  end $$;
  rollback;
`);
await db.exec(`
  do $$ declare v_count bigint; begin
    select count(*) into v_count from public.repair_work_ledger;
    if v_count<>0 then raise exception 'Rollback fixture rows leaked'; end if;
    if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in('list_repair_ledger_usage_dates_staff','link_repair_ledger_source_staff','list_repair_ledger_yp6')
        and p.prosecdef) then raise exception 'Public SECURITY DEFINER wrapper'; end if;
  end $$;
`);
await db.close();
console.log(`Isolated SQL integration passed: ${fileURLToPath(root)} (no external database connection)`);
