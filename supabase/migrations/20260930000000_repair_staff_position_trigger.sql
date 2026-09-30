-- The legacy trigger referenced public.position_tracking_settings, a table
-- that is not part of this application. It prevented every staff insert and
-- every update that changed a staff position.
drop trigger if exists trigger_sync_position on public.staff;
drop function if exists public.sync_new_position_to_settings();
