-- Only the trusted Pages Function may complete a delete, after Storage has
-- confirmed removal. A case writer can start or retry, but cannot remove the
-- metadata independently of the stored object.
create or replace function public.finish_case_attachment_delete(p_id uuid,p_deletion_token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare attachment public.case_attachments; current_archive timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  select * into attachment from public.case_attachments where id=p_id for update;
  if not found then return; end if;
  if attachment.deletion_token is null or attachment.deletion_token is distinct from p_deletion_token then
    raise exception 'Invalid attachment deletion token' using errcode='42501';
  end if;
  select f.archived_at into current_archive from public.families f where f.id=attachment.family_id for update;
  if not found or current_archive is not null then raise exception 'File not found' using errcode='P0002'; end if;
  delete from public.case_attachments where id=p_id;
end $$;
revoke all on function public.finish_case_attachment_delete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_case_attachment_delete(uuid,uuid) to service_role;
