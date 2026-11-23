-- Optimistic metadata edits share the same row version as atomic quantity adjustments.
create or replace function public.update_counted_item_details(
 p_item_id uuid,p_expected_version bigint,p_name text,p_minimum_quantity integer,p_target_quantity integer,p_location text,p_image_path text
) returns public.counted_items language plpgsql security invoker set search_path=pg_catalog,public as $$
declare changed public.counted_items;
begin
 if p_name is null or char_length(btrim(p_name)) not between 1 and 160
   or p_minimum_quantity is null or p_minimum_quantity<0
   or p_target_quantity is null or p_target_quantity<1
   or char_length(coalesce(p_location,''))>200
   or (p_image_path is not null and char_length(p_image_path)>500) then
   raise exception 'Invalid inventory item details';
 end if;
 update public.counted_items set name=btrim(p_name),minimum_quantity=p_minimum_quantity,target_quantity=p_target_quantity,
   location=coalesce(p_location,''),image_path=p_image_path,version=version+1
 where id=p_item_id and version=p_expected_version returning * into changed;
 if changed.id is null then raise exception 'Inventory item changed; reload before saving'; end if;
 return changed;
end $$;
revoke all on function public.update_counted_item_details(uuid,bigint,text,integer,integer,text,text) from public,anon;
grant execute on function public.update_counted_item_details(uuid,bigint,text,integer,integer,text,text) to authenticated;
