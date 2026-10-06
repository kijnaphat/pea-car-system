-- Lock the parent when an admin corrects a charging receipt, so a concurrent
-- return cannot pass its mileage check using the old receipt value.
do $$ declare v_def text; begin
  v_def:=pg_catalog.pg_get_functiondef('private.guard_in_trip_charge_mileage()'::regprocedure);
  if position('where id=new.parent_trip_log_id;' in v_def)=0 then
    raise exception 'Charge guard patch target missing';
  end if;
  execute replace(v_def,'where id=new.parent_trip_log_id;','where id=new.parent_trip_log_id for update;');
end; $$;
