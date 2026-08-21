alter table public.cars
  add column if not exists image_path text;

comment on column public.cars.image_path is
  'Relative object path in the public Supabase Storage bucket car-images.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-images',
  'car-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_select_car_images" on storage.objects;
create policy "admin_select_car_images"
on storage.objects for select to authenticated
using (
  bucket_id = 'car-images'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
);

drop policy if exists "admin_insert_car_images" on storage.objects;
create policy "admin_insert_car_images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'car-images'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
);

drop policy if exists "admin_update_car_images" on storage.objects;
create policy "admin_update_car_images"
on storage.objects for update to authenticated
using (
  bucket_id = 'car-images'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
)
with check (
  bucket_id = 'car-images'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
);

drop policy if exists "admin_delete_car_images" on storage.objects;
create policy "admin_delete_car_images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'car-images'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
);
