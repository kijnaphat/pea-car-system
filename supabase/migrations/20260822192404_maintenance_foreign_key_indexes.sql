create index if not exists car_maintenance_records_issue_category_code_idx
  on public.car_maintenance_records (issue_category_code);

create index if not exists car_maintenance_records_reported_by_staff_id_idx
  on public.car_maintenance_records (reported_by_staff_id);

create index if not exists car_maintenance_records_completed_by_staff_id_idx
  on public.car_maintenance_records (completed_by_staff_id)
  where completed_by_staff_id is not null;
