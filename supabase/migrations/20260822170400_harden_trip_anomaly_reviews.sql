alter function public.admin_acknowledge_trip_anomaly(bigint, text, text)
  security invoker;

drop policy if exists "admin_insert_trip_anomaly_reviews" on public.trip_anomaly_reviews;
create policy "admin_insert_trip_anomaly_reviews"
on public.trip_anomaly_reviews
for insert
to authenticated
with check (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
  and reviewed_by = (select auth.uid())
);

grant insert on table public.trip_anomaly_reviews to authenticated;
