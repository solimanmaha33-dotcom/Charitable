export type MemberAgeCandidate={personId:string;name:string;gender:'female'|'male'|null;birthDate:string|null;caseFileId:string;caseFileLabel:string;caseFileCode:string};
export type MemberAgeAlert=MemberAgeCandidate&{age:number;targetAge:18|21;daysUntilThreshold:number;thresholdDate:string};

export function ageOn(birthDate:string,today:string):number{
 const [birthYear,birthMonth,birthDay]=birthDate.split('-').map(Number);
 const [year,month,day]=today.split('-').map(Number);
 const hasHadBirthday=month>birthMonth||(month===birthMonth&&day>=birthDay);
 return year-birthYear-(hasHadBirthday?0:1);
}

function dateAtAge(birthDate:string,targetAge:number):string{
 const [year,month,day]=birthDate.split('-').map(Number);
 const value=new Date(Date.UTC(year+targetAge,month-1,day));
 return `${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,'0')}-${String(value.getUTCDate()).padStart(2,'0')}`;
}

export function findMemberAgeAlerts(members:MemberAgeCandidate[],today:string,windowDays=30):MemberAgeAlert[]{
 const todayTime=Date.parse(`${today}T00:00:00Z`);
 return members.flatMap(member=>{
  if(!member.birthDate||!member.gender)return[];
  const targetAge=member.gender==='female'?21:18;
  const thresholdDate=dateAtAge(member.birthDate,targetAge);
  const daysUntilThreshold=Math.round((Date.parse(`${thresholdDate}T00:00:00Z`)-todayTime)/86_400_000);
  if(daysUntilThreshold<0||daysUntilThreshold>windowDays)return[];
  return [{...member,age:ageOn(member.birthDate,today),targetAge,daysUntilThreshold,thresholdDate}];
 });
}
