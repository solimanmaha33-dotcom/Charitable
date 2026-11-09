-- Serialize child-record writes with archive transitions and cover data that
-- belongs to a case but lives in a different table.
create or replace function private.prevent_archived_case_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare family_ids uuid[] := array[]::uuid[];
begin
  if tg_op <> 'INSERT' then family_ids := array_append(family_ids,old.family_id); end if;
  if tg_op <> 'DELETE' then family_ids := array_append(family_ids,new.family_id); end if;
  perform f.id from public.families f where f.id=any(family_ids) order by f.id for update;
  if exists(select 1 from public.families f where f.id=any(family_ids) and f.archived_at is not null) then
    raise exception 'Archived case files cannot be changed' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

create function private.prevent_archived_person_edit()
returns trigger language plpgsql security definer set search_path='' as $$
declare family_ids uuid[];
begin
  select array_agg(f.id order by f.id) into family_ids
    from public.family_members fm join public.families f on f.id=fm.family_id
    where fm.person_id=old.id;
  if family_ids is null then return new; end if;
  perform f.id from public.families f where f.id=any(family_ids) order by f.id for update;
  if exists(
    select 1 from public.family_members fm join public.families f on f.id=fm.family_id
    where fm.person_id=old.id and f.archived_at is not null
  ) then
    raise exception 'People attached to archived case files cannot be changed' using errcode='42501';
  end if;
  return new;
end $$;
create trigger people_active_case_only
  before update on public.people
  for each row execute function private.prevent_archived_person_edit();

create function private.require_active_case_for_sponsorship()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_archive timestamptz;
begin
  select f.archived_at into current_archive from public.families f where f.id=new.family_id for update;
  if not found or current_archive is not null then
    raise exception 'New sponsorships require an active case file' using errcode='42501';
  end if;
  return new;
end $$;
create trigger sponsorship_active_case_only
  before insert on public.sponsorships
  for each row execute function private.require_active_case_for_sponsorship();

-- Attachment deletion spans PostgreSQL and Supabase Storage. Keep a durable
-- pending marker until Storage confirms removal so archive cannot race the
-- external deletion or strand an unlinked object.
alter table public.case_attachments add column deletion_token uuid;

create function private.reject_archive_with_pending_attachment_delete()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.archived_at is null and new.archived_at is not null and exists(
    select 1 from public.case_attachments a where a.family_id=old.id and a.deletion_token is not null
  ) then
    raise exception 'Finish pending attachment deletion before archiving' using errcode='55006';
  end if;
  return new;
end $$;
create trigger families_no_pending_attachment_archive
  before update of archived_at on public.families
  for each row execute function private.reject_archive_with_pending_attachment_delete();

create function public.begin_case_attachment_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare attachment public.case_attachments; current_archive timestamptz;
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  select * into attachment from public.case_attachments where id=p_id for update;
  if not found then return jsonb_build_object('done',true); end if;
  select f.archived_at into current_archive from public.families f where f.id=attachment.family_id for update;
  if not found or current_archive is not null then raise exception 'File not found' using errcode='P0002'; end if;
  if attachment.deletion_token is null then
    attachment.deletion_token:=gen_random_uuid();
    update public.case_attachments set deletion_token=attachment.deletion_token where id=p_id;
  end if;
  return jsonb_build_object('done',false,'storage_path',attachment.storage_path,'deletion_token',attachment.deletion_token);
end $$;

create function public.finish_case_attachment_delete(p_id uuid,p_deletion_token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare attachment public.case_attachments; current_archive timestamptz;
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  select * into attachment from public.case_attachments where id=p_id for update;
  if not found then return; end if;
  if attachment.deletion_token is null or attachment.deletion_token is distinct from p_deletion_token then
    raise exception 'Invalid attachment deletion token' using errcode='42501';
  end if;
  select f.archived_at into current_archive from public.families f where f.id=attachment.family_id for update;
  if not found or current_archive is not null then raise exception 'File not found' using errcode='P0002'; end if;
  delete from public.case_attachments where id=p_id;
end $$;

revoke all on function private.prevent_archived_case_write(),private.prevent_archived_person_edit(),private.require_active_case_for_sponsorship(),private.reject_archive_with_pending_attachment_delete() from public,anon,authenticated;
revoke all on function public.begin_case_attachment_delete(uuid),public.finish_case_attachment_delete(uuid,uuid) from public,anon;
grant execute on function public.begin_case_attachment_delete(uuid),public.finish_case_attachment_delete(uuid,uuid) to authenticated;
