-- Public RPC wrappers for vehicle and maintenance workflows are SECURITY
-- INVOKER functions that call tightly scoped private SECURITY DEFINER
-- implementations. They need schema USAGE to resolve those function names,
-- but must never receive direct access to private tables or sequences.
grant usage on schema private to anon, authenticated, service_role;

revoke all on all tables in schema private
  from public, anon, authenticated;
revoke all on all sequences in schema private
  from public, anon, authenticated;

-- Re-assert the workflow function grants that were defined by their original
-- migrations. No Discord/Vault helper is exposed to browser roles.
grant execute on function private.take_car_out_v3_impl(bigint, text, integer, text, integer, text, text, integer, integer[])
  to anon, authenticated, service_role;
grant execute on function private.report_car_maintenance_impl(bigint, text, text, text)
  to anon, authenticated, service_role;
grant execute on function private.complete_car_maintenance_impl(bigint, text, text)
  to anon, authenticated, service_role;
grant execute on function private.return_car_and_report_maintenance_impl(bigint, text, integer, numeric, numeric, integer, text, text)
  to anon, authenticated, service_role;
grant execute on function private.complete_car_maintenance_v2_impl(bigint, text, text, text, text[], text, numeric)
  to anon, authenticated, service_role;
grant execute on function private.complete_car_maintenance_v3_impl(bigint, text, text, text, text[], text, numeric)
  to anon, authenticated, service_role;
grant execute on function private.get_maintenance_takeout_handoff_impl(uuid, bigint)
  to anon, authenticated, service_role;
grant execute on function private.take_car_out_after_maintenance_impl(uuid, bigint, integer, text, integer, text, text, integer, integer[])
  to anon, authenticated, service_role;

-- Audit, Vault and queue functions stay inaccessible to browser roles.
revoke all on function private.queue_audit_event_to_channel(text, text, text, text, integer, text, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.process_discord_audit_queue()
  from public, anon, authenticated;
revoke all on function private.resolve_discord_audit_delivery_channel(text)
  from public, anon, authenticated;
