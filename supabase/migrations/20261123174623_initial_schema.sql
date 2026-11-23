-- Backroom inventory schema. Additive migration; the target project was empty at inspection.
create extension if not exists pgcrypto with schema extensions;

do $$ begin create type public.event_role as enum ('creator','admin','member'); exception when duplicate_object then null; end $$;
do $$ begin create type public.category_kind as enum ('counted','tracked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tracked_status as enum ('available','used'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tracked_field_type as enum ('text','number','date','boolean'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null,
  avatar_color text not null default '#dcea9b' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120), short_name text not null default '' check (char_length(short_name)<=40),
  location text not null default '' check (char_length(location)<=200), start_date date, end_date date,
  note text not null default '' check (char_length(note)<=2000), creator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.event_role not null default 'member', created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create table if not exists public.event_access_codes (
  event_id uuid primary key references public.events(id) on delete cascade,
  member_code_hash text not null, admin_code_hash text not null,
  member_rotated_at timestamptz not null default now(), admin_rotated_at timestamptz not null default now()
);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100), type public.category_kind not null,
  description text not null default '' check (char_length(description)<=1000), created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_id,name)
);
create table if not exists public.category_fields (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80), type public.tracked_field_type not null default 'text',
  required boolean not null default false, display_order integer not null default 0 check (display_order>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(category_id,label)
);
create table if not exists public.counted_items (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160), quantity integer not null default 0 check (quantity>=0),
  minimum_quantity integer not null default 0 check (minimum_quantity>=0), target_quantity integer not null default 1 check (target_quantity>=1),
  location text not null default '' check (char_length(location)<=200), image_path text,
  version bigint not null default 1 check (version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(category_id,name)
);
create table if not exists public.tracked_records (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id) on delete cascade,
  status public.tracked_status not null default 'available', assignment_note text not null default '' check (char_length(assignment_note)<=500),
  version bigint not null default 1 check (version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tracked_record_values (
  id uuid primary key default gen_random_uuid(), tracked_record_id uuid not null references public.tracked_records(id) on delete cascade,
  field_id uuid not null references public.category_fields(id) on delete cascade,
  value text not null default '' check (char_length(value)<=2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tracked_record_id,field_id)
);
create table if not exists public.activity_entries (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null, kind text not null check (kind in ('inventory','people','import','event')),
  title text not null check (char_length(title) between 1 and 200), detail text not null default '' check (char_length(detail)<=1000), created_at timestamptz not null default now()
);
create table if not exists public.notification_read_state (
  notification_id uuid not null references public.activity_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, read_at timestamptz not null default now(), primary key(notification_id,user_id)
);
create index if not exists events_creator_idx on public.events(creator_id);
create index if not exists event_members_user_idx on public.event_members(user_id,event_id);
create index if not exists categories_event_idx on public.categories(event_id,type);
create index if not exists counted_items_category_idx on public.counted_items(category_id,name);
create index if not exists tracked_records_category_idx on public.tracked_records(category_id,status);
create index if not exists activity_entries_event_time_idx on public.activity_entries(event_id,created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=pg_catalog as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','events','categories','category_fields','counted_items','tracked_records','tracked_record_values'] loop
  execute format('drop trigger if exists %I_touch on public.%I',t,t);
  execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',t,t);
end loop; end $$;

create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin insert into public.profiles(id,name,email) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),coalesce(new.email,'')) on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_user();

create or replace function public.is_event_member(p_event_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.event_members m where m.event_id=p_event_id and m.user_id=(select auth.uid())) $$;
create or replace function public.has_event_role(p_event_id uuid,p_roles public.event_role[]) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.event_members m where m.event_id=p_event_id and m.user_id=(select auth.uid()) and m.role=any(p_roles)) $$;
revoke all on function public.is_event_member(uuid) from public;
revoke all on function public.has_event_role(uuid,public.event_role[]) from public;
grant execute on function public.is_event_member(uuid),public.has_event_role(uuid,public.event_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_access_codes enable row level security;
alter table public.categories enable row level security;
alter table public.category_fields enable row level security;
alter table public.counted_items enable row level security;
alter table public.tracked_records enable row level security;
alter table public.tracked_record_values enable row level security;
alter table public.activity_entries enable row level security;
alter table public.notification_read_state enable row level security;

drop policy if exists profile_read_event_peers on public.profiles;
create policy profile_read_event_peers on public.profiles for select to authenticated using (id=(select auth.uid()) or exists(select 1 from public.event_members mine join public.event_members peer using(event_id) where mine.user_id=(select auth.uid()) and peer.user_id=profiles.id));
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
drop policy if exists events_member_read on public.events;
create policy events_member_read on public.events for select to authenticated using (public.is_event_member(id));
drop policy if exists events_create_self on public.events;
create policy events_create_self on public.events for insert to authenticated with check (creator_id=(select auth.uid()));
drop policy if exists events_manager_update on public.events;
create policy events_manager_update on public.events for update to authenticated using (public.has_event_role(id,array['creator','admin']::public.event_role[])) with check (public.has_event_role(id,array['creator','admin']::public.event_role[]));
drop policy if exists events_creator_delete on public.events;
create policy events_creator_delete on public.events for delete to authenticated using (public.has_event_role(id,array['creator']::public.event_role[]));
drop policy if exists members_read_event on public.event_members;
create policy members_read_event on public.event_members for select to authenticated using (public.is_event_member(event_id));
drop policy if exists members_manage_event on public.event_members;
create policy members_manage_event on public.event_members for all to authenticated using (public.has_event_role(event_id,array['creator','admin']::public.event_role[])) with check (public.has_event_role(event_id,array['creator','admin']::public.event_role[]));
-- Code hashes are never readable by browser roles; secure RPCs own code verification/rotation.
revoke all on public.event_access_codes from anon,authenticated;
drop policy if exists categories_read_member on public.categories;
create policy categories_read_member on public.categories for select to authenticated using (public.is_event_member(event_id));
drop policy if exists categories_manage_admin on public.categories;
create policy categories_manage_admin on public.categories for all to authenticated using (public.has_event_role(event_id,array['creator','admin']::public.event_role[])) with check (public.has_event_role(event_id,array['creator','admin']::public.event_role[]));
drop policy if exists fields_read_member on public.category_fields;
create policy fields_read_member on public.category_fields for select to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists fields_manage_admin on public.category_fields;
create policy fields_manage_admin on public.category_fields for all to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[]))) with check (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[])));
drop policy if exists counted_read_member on public.counted_items;
create policy counted_read_member on public.counted_items for select to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists counted_insert_member on public.counted_items;
create policy counted_insert_member on public.counted_items for insert to authenticated with check (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists counted_update_member on public.counted_items;
create policy counted_update_member on public.counted_items for update to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id))) with check (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists counted_delete_admin on public.counted_items;
create policy counted_delete_admin on public.counted_items for delete to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[])));
drop policy if exists tracked_read_member on public.tracked_records;
create policy tracked_read_member on public.tracked_records for select to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists tracked_insert_member on public.tracked_records;
create policy tracked_insert_member on public.tracked_records for insert to authenticated with check (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists tracked_update_member on public.tracked_records;
create policy tracked_update_member on public.tracked_records for update to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id))) with check (exists(select 1 from public.categories c where c.id=category_id and public.is_event_member(c.event_id)));
drop policy if exists tracked_delete_admin on public.tracked_records;
create policy tracked_delete_admin on public.tracked_records for delete to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[])));
drop policy if exists values_read_member on public.tracked_record_values;
create policy values_read_member on public.tracked_record_values for select to authenticated using (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id)));
drop policy if exists values_write_member on public.tracked_record_values;
create policy values_write_member on public.tracked_record_values for all to authenticated using (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id))) with check (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id)));
drop policy if exists activity_read_member on public.activity_entries;
create policy activity_read_member on public.activity_entries for select to authenticated using (public.is_event_member(event_id));
drop policy if exists activity_insert_member on public.activity_entries;
create policy activity_insert_member on public.activity_entries for insert to authenticated with check (actor_id=(select auth.uid()) and public.is_event_member(event_id));
drop policy if exists read_state_self on public.notification_read_state;
create policy read_state_self on public.notification_read_state for all to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.activity_entries a where a.id=notification_id and public.is_event_member(a.event_id))) with check (user_id=(select auth.uid()) and exists(select 1 from public.activity_entries a where a.id=notification_id and public.is_event_member(a.event_id)));

grant select on public.profiles to authenticated;
grant update(name,avatar_color) on public.profiles to authenticated;
grant select,insert,update,delete on public.events,public.event_members,public.categories,public.category_fields,public.counted_items,public.tracked_records,public.tracked_record_values,public.activity_entries,public.notification_read_state to authenticated;

-- Safe atomic quantity update with optimistic version check; authorization is enforced by RLS.
create or replace function public.adjust_counted_quantity(p_item_id uuid,p_delta integer,p_expected_version bigint)
returns public.counted_items language plpgsql security invoker set search_path=pg_catalog,public as $$
declare changed public.counted_items;
begin
 if p_delta=0 or abs(p_delta)>100000 then raise exception 'Invalid quantity change'; end if;
 update public.counted_items set quantity=quantity+p_delta,version=version+1
 where id=p_item_id and version=p_expected_version and quantity+p_delta>=0 returning * into changed;
 if changed.id is null then raise exception 'Inventory changed or quantity is invalid'; end if;
 return changed;
end $$;
grant execute on function public.adjust_counted_quantity(uuid,integer,bigint) to authenticated;

-- Storage paths start with the event UUID. Event membership controls reads; editors manage files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('inventory-images','inventory-images',false,1572864,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists inventory_images_read on storage.objects;
create policy inventory_images_read on storage.objects for select to authenticated using (bucket_id='inventory-images' and public.is_event_member((storage.foldername(name))[1]::uuid));
drop policy if exists inventory_images_insert on storage.objects;
create policy inventory_images_insert on storage.objects for insert to authenticated with check (bucket_id='inventory-images' and public.is_event_member((storage.foldername(name))[1]::uuid));
drop policy if exists inventory_images_update on storage.objects;
create policy inventory_images_update on storage.objects for update to authenticated using (bucket_id='inventory-images' and public.has_event_role((storage.foldername(name))[1]::uuid,array['creator','admin']::public.event_role[])) with check (bucket_id='inventory-images' and public.has_event_role((storage.foldername(name))[1]::uuid,array['creator','admin']::public.event_role[]));
drop policy if exists inventory_images_delete on storage.objects;
create policy inventory_images_delete on storage.objects for delete to authenticated using (bucket_id='inventory-images' and public.has_event_role((storage.foldername(name))[1]::uuid,array['creator','admin']::public.event_role[]));

-- Privileged membership and invitation operations. Codes are generated once, hashed at rest,
-- and returned only to the caller who created/rotated them.
create or replace function public.create_event(p_name text,p_short_name text default '',p_location text default '',p_start_date date default null,p_end_date date default null,p_note text default '')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare eid uuid; member_code text; admin_code text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or char_length(coalesce(p_note,''))>2000 then raise exception 'Check the event details'; end if;
 if p_start_date is not null and p_end_date is not null and p_end_date<p_start_date then raise exception 'End date must follow start date'; end if;
 member_code:=rtrim(translate(encode(extensions.gen_random_bytes(15),'base64'),'+/','AZ'),'=');
 admin_code:=rtrim(translate(encode(extensions.gen_random_bytes(15),'base64'),'+/','AZ'),'=');
 insert into public.events(name,short_name,location,start_date,end_date,note,creator_id)
 values(btrim(p_name),left(btrim(coalesce(p_short_name,'')),40),left(btrim(coalesce(p_location,'')),200),p_start_date,p_end_date,btrim(coalesce(p_note,'')),auth.uid()) returning id into eid;
 insert into public.event_members(event_id,user_id,role) values(eid,auth.uid(),'creator');
 insert into public.event_access_codes(event_id,member_code_hash,admin_code_hash)
 values(eid,extensions.crypt(member_code,extensions.gen_salt('bf')),extensions.crypt(admin_code,extensions.gen_salt('bf')));
 return jsonb_build_object('id',eid,'member_code',member_code,'admin_code',admin_code);
end $$;
create or replace function public.join_event(p_code text,p_admin boolean default false)
returns public.event_members language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare access_row public.event_access_codes; joined public.event_members; eid uuid; wanted public.event_role;
begin
 if auth.uid() is null or p_code is null or char_length(p_code) not between 12 and 64 then raise exception 'That access code is not active'; end if;
 select c.* into access_row from public.event_access_codes c where (case when p_admin then c.admin_code_hash else c.member_code_hash end)=extensions.crypt(p_code,case when p_admin then c.admin_code_hash else c.member_code_hash end) limit 1;
 if access_row.event_id is null then raise exception 'That access code is not active'; end if;
 eid:=access_row.event_id; wanted:=case when p_admin then 'admin'::public.event_role else 'member'::public.event_role end;
 insert into public.event_members(event_id,user_id,role) values(eid,auth.uid(),wanted)
 on conflict(event_id,user_id) do update set role=case when event_members.role='creator' then 'creator'::public.event_role when p_admin then 'admin'::public.event_role else event_members.role end
 returning * into joined;
 return joined;
end $$;
create or replace function public.rotate_event_code(p_event_id uuid,p_admin boolean default false)
returns text language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare fresh text; hashed text;
begin
 if not public.has_event_role(p_event_id,array['creator','admin']::public.event_role[]) or (p_admin and not public.has_event_role(p_event_id,array['creator']::public.event_role[])) then raise exception 'You cannot manage this event'; end if;
 fresh:=rtrim(translate(encode(extensions.gen_random_bytes(15),'base64'),'+/','AZ'),'=');
 hashed:=extensions.crypt(fresh,extensions.gen_salt('bf'));
 if p_admin then update public.event_access_codes set admin_code_hash=hashed,admin_rotated_at=now() where event_id=p_event_id;
 else update public.event_access_codes set member_code_hash=hashed,member_rotated_at=now() where event_id=p_event_id; end if;
 if not found then raise exception 'Event access is unavailable'; end if;
 return fresh;
end $$;
revoke all on function public.create_event(text,text,text,date,date,text),public.join_event(text,boolean),public.rotate_event_code(uuid,boolean) from public,anon;
grant execute on function public.create_event(text,text,text,date,date,text),public.join_event(text,boolean),public.rotate_event_code(uuid,boolean) to authenticated;

-- Restrict membership role changes to event creators. Admins can add/remove members by policy,
-- but cannot grant the creator role or alter existing roles.
drop policy if exists members_manage_event on public.event_members;
create policy members_insert_event on public.event_members for insert to authenticated with check (
 user_id=(select auth.uid()) and role='member'
 or public.has_event_role(event_id,array['creator']::public.event_role[]) and role<>'creator'
 or public.has_event_role(event_id,array['admin']::public.event_role[]) and role='member'
);
create policy members_delete_event on public.event_members for delete to authenticated using (
 public.has_event_role(event_id,array['creator','admin']::public.event_role[])
 and (role<>'creator' or user_id=(select auth.uid()))
);
create policy members_update_creator on public.event_members for update to authenticated using (
 public.has_event_role(event_id,array['creator']::public.event_role[])
) with check (public.has_event_role(event_id,array['creator']::public.event_role[]));

-- Publish workspace changes to authenticated Realtime subscribers without duplicating entries.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['events','event_members','categories','counted_items','tracked_records','activity_entries'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
