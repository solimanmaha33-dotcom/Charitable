import {expect,it} from 'vitest';
import {ageOn,findMemberAgeAlerts,type MemberAgeCandidate} from './memberAge';

const member=(id:string,gender:'female'|'male'|null,birthDate:string|null):MemberAgeCandidate=>({personId:id,name:`فرد ${id}`,gender,birthDate,caseFileId:'file-1',caseFileLabel:'ملف اختبار',caseFileCode:'F-0001'});

it('calculates age before and on the birthday',()=>{
 expect(ageOn('2008-11-08','2026-11-07')).toBe(17);
 expect(ageOn('2008-11-08','2026-11-08')).toBe(18);
});

it('treats a February 29 birthday as March 1 in a non-leap year',()=>{
 expect(ageOn('2008-02-29','2026-02-28')).toBe(17);
 expect(ageOn('2008-02-29','2026-03-01')).toBe(18);
 expect(findMemberAgeAlerts([member('leap-day','male','2008-02-29')],'2026-02-28')[0]?.thresholdDate).toBe('2026-03-01');
});

it('alerts girls before 21 and boys before 18 through day 30 inclusive',()=>{
 const alerts=findMemberAgeAlerts([
  member('girl','female','2005-12-07'),
  member('boy','male','2008-12-07'),
  member('today','male','2008-11-07'),
  member('day-31','female','2005-12-08'),
  member('past','male','2000-01-01'),
  member('unknown',null,'2008-12-31'),
  member('no-birthdate','female',null),
 ],'2026-11-07');
 expect(alerts.map(row=>[row.personId,row.targetAge,row.daysUntilThreshold])).toEqual([
  ['girl',21,30],['boy',18,30],['today',18,0],
 ]);
});
