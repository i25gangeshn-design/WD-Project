-- Keep event access codes stable and expose them only to the event creator.
alter table public.event_access_codes
  add column if not exists member_code text,
  add column if not exists admin_code text;

do $$
declare access_row record; fresh_member_code text; fresh_admin_code text;
begin
  for access_row in
    select event_id from public.event_access_codes
    where member_code is null or admin_code is null
  loop
    fresh_member_code := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', 'AZ'), '=');
    fresh_admin_code := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', 'AZ'), '=');
    update public.event_access_codes
    set member_code = fresh_member_code,
        admin_code = fresh_admin_code,
        member_code_hash = extensions.crypt(fresh_member_code, extensions.gen_salt('bf')),
        admin_code_hash = extensions.crypt(fresh_admin_code, extensions.gen_salt('bf')),
        member_rotated_at = now(),
        admin_rotated_at = now()
    where event_id = access_row.event_id;
  end loop;
end
$$;

alter table public.event_access_codes
  alter column member_code set not null,
  alter column admin_code set not null;

create or replace function public.create_event(
  p_name text,
  p_short_name text default '',
  p_location text default '',
  p_start_date date default null,
  p_end_date date default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare event_id uuid; member_code text; admin_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Check the event details';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'End date must follow start date';
  end if;

  member_code := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', 'AZ'), '=');
  admin_code := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', 'AZ'), '=');

  insert into public.events(name, short_name, location, start_date, end_date, note, creator_id)
  values (
    btrim(p_name),
    left(btrim(coalesce(p_short_name, '')), 40),
    left(btrim(coalesce(p_location, '')), 200),
    p_start_date, p_end_date, btrim(coalesce(p_note, '')), auth.uid()
  )
  returning id into event_id;

  insert into public.event_members(event_id, user_id, role)
  values(event_id, auth.uid(), 'creator');

  insert into public.event_access_codes(event_id, member_code, admin_code, member_code_hash, admin_code_hash)
  values (
    event_id, member_code, admin_code,
    extensions.crypt(member_code, extensions.gen_salt('bf')),
    extensions.crypt(admin_code, extensions.gen_salt('bf'))
  );

  return jsonb_build_object('id', event_id, 'member_code', member_code, 'admin_code', admin_code);
end
$$;

-- p_admin is retained for RPC compatibility but ignored; the entered code determines access.
create or replace function public.join_event(p_code text, p_admin boolean default false)
returns public.event_members
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare event_id uuid; code_is_admin boolean; joined public.event_members; requested_role public.event_role;
begin
  if auth.uid() is null or p_code is null or char_length(btrim(p_code)) not between 12 and 64 then
    raise exception 'That access code is not active';
  end if;

  select c.event_id,
         c.admin_code_hash = extensions.crypt(btrim(p_code), c.admin_code_hash)
  into event_id, code_is_admin
  from public.event_access_codes c
  where c.member_code_hash = extensions.crypt(btrim(p_code), c.member_code_hash)
     or c.admin_code_hash = extensions.crypt(btrim(p_code), c.admin_code_hash)
  limit 1;

  if event_id is null then raise exception 'That access code is not active'; end if;
  requested_role := case when code_is_admin then 'admin'::public.event_role else 'member'::public.event_role end;

  insert into public.event_members(event_id, user_id, role)
  values(event_id, auth.uid(), requested_role)
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

create or replace function public.get_event_access_codes()
returns table(event_id uuid, member_code text, admin_code text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select codes.event_id, codes.member_code, codes.admin_code
  from public.event_access_codes codes
  join public.events event on event.id = codes.event_id
  where (select auth.uid()) is not null
    and event.creator_id = (select auth.uid())
$$;

revoke all on function public.create_event(text,text,text,date,date,text) from public, anon;
revoke all on function public.join_event(text,boolean) from public, anon;
revoke all on function public.get_event_access_codes() from public, anon, authenticated;
grant execute on function public.create_event(text,text,text,date,date,text) to authenticated;
grant execute on function public.join_event(text,boolean) to authenticated;
grant execute on function public.get_event_access_codes() to authenticated;

-- Codes are now permanent for the lifetime of an event.
drop function if exists public.rotate_event_code(uuid,boolean);

notify pgrst, 'reload schema';
