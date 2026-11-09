import { addDateOnlyDays, cairoToday } from '../../shared/cairoDate';

export type CaseReviewRecord = { id:string; code:string; father_name:string|null; mother_name:string|null; next_review_date:string };
export type CaseReviewGroups = {
  overdue:Array<CaseReviewRecord & {daysOverdue:number}>;
  upcoming:Array<CaseReviewRecord & {daysLeft:number}>;
};

function validDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export function groupCaseReviewReminders(rows:CaseReviewRecord[],today=cairoToday()):CaseReviewGroups {
  if(!validDate(today))throw new Error('Expected a valid Cairo calendar date');
  const cutoff=addDateOnlyDays(today,30);
  const overdue:CaseReviewGroups['overdue']=[];
  const upcoming:CaseReviewGroups['upcoming']=[];
  for(const row of rows){
    if(!validDate(row.next_review_date))throw new Error('Expected a valid case review date');
    if(row.next_review_date<today){
      overdue.push({...row,daysOverdue:Math.round((Date.parse(`${today}T00:00:00Z`)-Date.parse(`${row.next_review_date}T00:00:00Z`))/86_400_000)});
    }else if(row.next_review_date<=cutoff){
      upcoming.push({...row,daysLeft:Math.round((Date.parse(`${row.next_review_date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86_400_000)});
    }
  }
  overdue.sort((a,b)=>a.next_review_date.localeCompare(b.next_review_date)||a.id.localeCompare(b.id));
  upcoming.sort((a,b)=>a.next_review_date.localeCompare(b.next_review_date)||a.id.localeCompare(b.id));
  return {overdue,upcoming};
}
