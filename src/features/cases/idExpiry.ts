export type RawIdExpiryRecord = { id:string; code:string; father_name:string|null; mother_name:string|null; contact_name:string|null; national_id_expires_on:string|null; father_national_id_expires_on:string|null; mother_national_id_expires_on:string|null };
export type IdExpiryRecord = Omit<RawIdExpiryRecord,'national_id_expires_on'|'father_national_id_expires_on'|'mother_national_id_expires_on'> & { national_id_expires_on:string; identity_holder:string };
export type IdExpiryGroups = { expired:IdExpiryRecord[]; upcoming:Array<IdExpiryRecord & { daysLeft:number }> };

export { addDateOnlyDays, cairoToday } from '../../shared/cairoDate';

export function expandIdentityExpirations(rows:RawIdExpiryRecord[], cutoff:string):IdExpiryRecord[] {
  return rows.flatMap((row) => [
    { date:row.father_national_id_expires_on, holder:'الأب' },
    { date:row.mother_national_id_expires_on, holder:'الأم' },
    { date:row.national_id_expires_on, holder:'المسؤول' },
  ].filter((item):item is {date:string;holder:string}=>!!item.date&&item.date<=cutoff).map(({date,holder})=>({
    id:row.id,code:row.code,father_name:row.father_name,mother_name:row.mother_name,contact_name:row.contact_name,
    national_id_expires_on:date,identity_holder:holder,
  }))).sort((a,b)=>a.national_id_expires_on.localeCompare(b.national_id_expires_on)||a.id.localeCompare(b.id)||a.identity_holder.localeCompare(b.identity_holder,'ar-EG'));
}

export function groupIdExpirations(rows:IdExpiryRecord[], today:string):IdExpiryGroups {
  const expired:IdExpiryRecord[]=[];
  const upcoming:Array<IdExpiryRecord & {daysLeft:number}>=[];
  const todayTime=Date.parse(`${today}T00:00:00Z`);
  for(const row of rows){
    const expiresTime=Date.parse(`${row.national_id_expires_on}T00:00:00Z`);
    if(row.national_id_expires_on < today){ expired.push(row); continue; }
    const daysLeft=Math.round((expiresTime-todayTime)/86_400_000);
    if(daysLeft<=30) upcoming.push({...row,daysLeft});
  }
  return {expired,upcoming};
}
