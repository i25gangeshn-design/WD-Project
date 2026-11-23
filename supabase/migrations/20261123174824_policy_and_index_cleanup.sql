-- Close the profile trigger function to direct PostgREST invocation. It remains callable by its trigger.
revoke all on function public.create_profile_for_user() from public,anon,authenticated;

-- The hash table intentionally has no readable or writable client policy; explicit false policy documents deny-by-default.
drop policy if exists event_access_codes_deny_clients on public.event_access_codes;
create policy event_access_codes_deny_clients on public.event_access_codes for all to anon,authenticated using (false) with check (false);

-- Split read and management policies so reads do not evaluate redundant manager checks.
drop policy if exists categories_manage_admin on public.categories;
create policy categories_insert_admin on public.categories for insert to authenticated with check (public.has_event_role(event_id,array['creator','admin']::public.event_role[]));
create policy categories_update_admin on public.categories for update to authenticated using (public.has_event_role(event_id,array['creator','admin']::public.event_role[])) with check (public.has_event_role(event_id,array['creator','admin']::public.event_role[]));
create policy categories_delete_admin on public.categories for delete to authenticated using (public.has_event_role(event_id,array['creator','admin']::public.event_role[]));
drop policy if exists fields_manage_admin on public.category_fields;
create policy fields_insert_admin on public.category_fields for insert to authenticated with check (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[])));
create policy fields_update_admin on public.category_fields for update to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[]))) with check (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[])));
create policy fields_delete_admin on public.category_fields for delete to authenticated using (exists(select 1 from public.categories c where c.id=category_id and public.has_event_role(c.event_id,array['creator','admin']::public.event_role[])));
drop policy if exists values_write_member on public.tracked_record_values;
create policy values_insert_member on public.tracked_record_values for insert to authenticated with check (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id)));
create policy values_update_member on public.tracked_record_values for update to authenticated using (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id))) with check (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id)));
create policy values_delete_member on public.tracked_record_values for delete to authenticated using (exists(select 1 from public.tracked_records r join public.categories c on c.id=r.category_id where r.id=tracked_record_id and public.is_event_member(c.event_id)));

create index if not exists activity_entries_actor_idx on public.activity_entries(actor_id);
create index if not exists categories_created_by_idx on public.categories(created_by);
create index if not exists notification_read_state_user_idx on public.notification_read_state(user_id);
create index if not exists tracked_record_values_field_idx on public.tracked_record_values(field_id);

-- A field value must reference a field from the same tracked category, and values are type-checked.
create or replace function public.validate_tracked_record_value() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare record_category uuid; field_row public.category_fields;
begin
 select r.category_id into record_category from public.tracked_records r where r.id=new.tracked_record_id;
 select f.* into field_row from public.category_fields f where f.id=new.field_id;
 if record_category is null or field_row.id is null or field_row.category_id<>record_category then raise exception 'Field does not belong to this tracked category'; end if;
 if field_row.type='number' and new.value<>'' and new.value !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception 'Enter a valid number'; end if;
 if field_row.type='date' and new.value<>'' and new.value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter a valid date'; end if;
 if field_row.type='boolean' and new.value not in ('true','false','') then raise exception 'Enter true or false'; end if;
 return new;
end $$;
drop trigger if exists tracked_value_validate on public.tracked_record_values;
create trigger tracked_value_validate before insert or update on public.tracked_record_values for each row execute function public.validate_tracked_record_value();
revoke all on function public.validate_tracked_record_value() from public,anon,authenticated;
