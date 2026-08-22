do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'private.complete_car_maintenance_v2_impl(bigint,text,text,text,text[],text,numeric)'::regprocedure
  ) into v_definition;

  execute replace(v_definition, 'pg_catalog.coalesce', 'coalesce');
end;
$$;
