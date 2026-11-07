export type IdExpiryRecord = { id:string; code:string; name:string; contact_name:string|null; national_id_expires_on:string };
export type IdExpiryGroups = { expired:IdExpiryRecord[]; upcoming:Array<IdExpiryRecord & { daysLeft:number }> };

export function cairoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  const part = (type:Intl.DateTimeFormatPartTypes) => parts.find(item=>item.type===type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDateOnlyDays(date:string, days:number):string {
  const [year,month,day]=date.split('-').map(Number);
  const value=new Date(Date.UTC(year,month-1,day+days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,'0')}-${String(value.getUTCDate()).padStart(2,'0')}`;
}

export function groupIdExpirations(rows:IdExpiryRecord[], today:string):IdExpiryGroups {
  const expired:IdExpiryRecord[]=[];
  const upcoming:Array<IdExpiryRecord & {daysLeft:number}>=[];
  const todayTime=Date.parse(`${today}T00:00:00Z`);
  for(const row of rows){
    const expiresTime=Date.parse(`${row.national_id_expires_on}T00:00:00Z`);
    if(row.national_id_expires_on < today){ expired.push(row); continue; }
    const daysLeft=Math.round((expiresTime-todayTime)/86_400_000);
    if(daysLeft<=90) upcoming.push({...row,daysLeft});
  }
  return {expired,upcoming};
}
