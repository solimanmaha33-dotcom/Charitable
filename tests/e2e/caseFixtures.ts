type CaseReadResult = {data: {id: string; code: string}|null; error: unknown|null};
type CaseReader = (id: string) => PromiseLike<CaseReadResult>;

type SqlExecutor = (input: string) => unknown;

function sqlLiteral(value: string): string {
 return `'${value.replaceAll("'", "''")}'`;
}

export async function createSyntheticCaseFile(
 read: CaseReader,
 sql: SqlExecutor,
 profile: {name: string; phone: string; motherName?: string; archivedBy?: string},
): Promise<{id: string; code: string}> {
 const id=crypto.randomUUID();
 const motherName=profile.motherName??'أم وهمية';
 sql(`begin;
insert into public.families(id,name,phone,mother_name,mother_national_id) values (${sqlLiteral(id)},${sqlLiteral(profile.name)},${sqlLiteral(profile.phone)},${sqlLiteral(motherName)},'29001011234567');
insert into public.case_file_categories(family_id,category) values (${sqlLiteral(id)},'أخرى');
commit;`);
if(profile.archivedBy)sql(`begin;
alter table public.families disable trigger families_archive_before_edit;
update public.families set archived_at=now(),archived_by=${sqlLiteral(profile.archivedBy)} where id=${sqlLiteral(id)};
alter table public.families enable trigger families_archive_before_edit;
commit;`);
 const {data,error}=await read(id);
 if(error||!data)throw error??new Error('Synthetic case file was not created');
 return data;
}
