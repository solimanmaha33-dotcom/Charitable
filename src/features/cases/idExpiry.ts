export type IdExpiryRecord = { id:string; code:string; father_name:string|null; mother_name:string|null; contact_name:string|null; national_id_expires_on:string };
export type IdExpiryGroups = { expired:IdExpiryRecord[]; upcoming:Array<IdExpiryRecord & { daysLeft:number }> };

export { addDateOnlyDays, cairoToday } from '../../shared/cairoDate';

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
