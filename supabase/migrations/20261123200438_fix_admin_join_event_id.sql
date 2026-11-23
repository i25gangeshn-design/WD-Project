-- Keep PL/pgSQL variable names distinct from event_members column names.
create or replace function public.join_event(p_code text,p_admin boolean default false)
returns public.event_members
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare joined_event_id uuid; code_is_admin boolean; joined public.event_members; requested_role public.event_role;
begin
  if auth.uid() is null or p_code is null or char_length(btrim(p_code)) not between 12 and 64 then
    raise exception 'That access code is not active';
  end if;

  select c.event_id,
         c.admin_code_hash = extensions.crypt(btrim(p_code), c.admin_code_hash)
  into joined_event_id, code_is_admin
  from public.event_access_codes c
  where c.member_code_hash = extensions.crypt(btrim(p_code), c.member_code_hash)
     or c.admin_code_hash = extensions.crypt(btrim(p_code), c.admin_code_hash)
  limit 1;

  if joined_event_id is null then raise exception 'That access code is not active'; end if;
  requested_role := case when code_is_admin then 'admin'::public.event_role else 'member'::public.event_role end;

  insert into public.event_members(event_id, user_id, role)
  values(joined_event_id, auth.uid(), requested_role)
  on conflict(event_id, user_id) do update
  set role = case
    when event_members.role = 'creator' then 'creator'::public.event_role
    when code_is_admin then 'admin'::public.event_role
    else event_members.role
  end
  returning * into joined;

  return joined;
end
$$;

revoke all on function public.join_event(text,boolean) from public, anon;
grant execute on function public.join_event(text,boolean) to authenticated;
notify pgrst, 'reload schema';
