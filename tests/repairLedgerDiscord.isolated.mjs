// PGLITE_MODULE=/absolute/node_modules/@electric-sql/pglite/dist/index.js node tests/repairLedgerDiscord.isolated.mjs
// Runs a fresh local-only database. No Supabase connection, webhook or HTTP worker.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function sourceFunction(source, name) {
  const start = source.indexOf(`create or replace function ${name}(`);
  const end = source.indexOf('\n$$;', start);
  if (start < 0 || end < 0) throw new Error(`Missing SQL fixture function: ${name}`);
  return source.slice(start, end + '\n$$;'.length);
}

export async function runRepairLedgerDiscordIsolated(db, root) {
  const initial = await fs.readFile(new URL('supabase/migrations/20260826103000_discord_audit_logs.sql', root), 'utf8');
  const expanded = await fs.readFile(new URL('supabase/migrations/20260826143000_expand_discord_audit_channels.sql', root), 'utf8');
  const dedicated = await fs.readFile(new URL('supabase/migrations/20260905035420_lock_daily_summary_to_dedicated_channel_and_send_test.sql', root), 'utf8');
  const tableStart = initial.indexOf('create table if not exists public.audit_events (');
  const tableEnd = initial.indexOf('\n);', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('Missing source audit table');
  await db.exec(initial.slice(tableStart, tableEnd + '\n);'.length));
  await db.exec(`
    alter table public.audit_events enable row level security;
    alter table public.audit_events add column intended_channel_key text not null default 'system',
      add column delivery_channel_key text;
    revoke all on public.audit_events from public,anon,authenticated;
    create table private.discord_audit_channels(channel_key text primary key,enabled boolean,webhook_secret_id uuid);
    -- Fake configured channel metadata only; there is no secret, webhook URL, HTTP or worker.
    insert into private.discord_audit_channels
      select key,true,gen_random_uuid() from unnest(array['maintenance_billing','maintenance','all','daily_summary']) key;
    insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');
  `);
  for (const [source, name] of [
    [initial, 'private.discord_audit_field'],
    [initial, 'private.build_discord_audit_payload'],
    [expanded, 'private.discord_audit_channel_for_event'],
    [expanded, 'private.discord_audit_parent_channel'],
    [dedicated, 'private.resolve_discord_audit_delivery_channel'],
    [expanded, 'private.queue_audit_event_to_channel'],
  ]) await db.exec(sourceFunction(source, name));
  await db.exec(`
    revoke all on function private.discord_audit_field(text,text,boolean) from public,anon,authenticated;
    revoke all on function private.build_discord_audit_payload(public.audit_events) from public,anon,authenticated;
    revoke all on function private.queue_audit_event_to_channel(text,text,text,text,integer,text,text,text,jsonb,text,jsonb)
      from public,anon,authenticated;
    -- Second existing optional report exercises linking and importing independently.
    insert into public.car_maintenance_records values('22222222-2222-4222-8222-222222222222',1,now(),now(),
      'isolated second optional report','isolated second completed work','billed',75,'completed',101);
  `);
  await db.exec(await fs.readFile(new URL('supabase/migrations/20261022040850_repair_ledger_discord_notifications.sql', root), 'utf8'));
  await db.exec(await fs.readFile(new URL('tests/repairLedgerDiscord.db.sql', root), 'utf8'));
  const result = await db.query('select count(*)::integer as count from public.audit_events');
  if (result.rows[0].count !== 0) throw new Error('Discord rollback suite leaked outbox rows');
  console.log('Repair ledger Discord SQL checks passed (real queue/field/payload functions, no network or external database)');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./repairLedgerUsage.isolated.mjs', import.meta.url))], {
    env: { ...process.env, REPAIR_LEDGER_DISCORD_TEST: '1' }, stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}
