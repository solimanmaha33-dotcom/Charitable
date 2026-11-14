import type { CaseFile, CaseFileMember } from '../../services/cases';
import { ageOn } from './memberAge';
import { isChildRelationship } from './memberRelationship';

export type CaseAgeFilter = 'all' | 'orphans' | 'under18' | 'under21' | 'elderly';
const LEGACY_ORPHAN_CATEGORY='يتيم الأب';
export function calculatePerCapitaNetIncome(totalIncome:number|null,fixedExpenses:number,memberCount:number):number|null {
  if(totalIncome===null||!Number.isFinite(totalIncome)||totalIncome<0||!Number.isFinite(fixedExpenses)||fixedExpenses<0||!Number.isInteger(memberCount)||memberCount<1)return null;
  return Math.round(((totalIncome-fixedExpenses)/memberCount)*100)/100;
}
function memberAge(member: CaseFileMember, today: string): number | null {
  const birthDate = member.people.date_of_birth;
  if (!birthDate) return null;
  const age = ageOn(birthDate, today);
  return Number.isInteger(age) && age >= 0 ? age : null;
}
function isOrphan(member:CaseFileMember,legacyOrphanFiles:Set<string>):boolean{
 return (member.father_status==='يتيم الأب'&&isChildRelationship(member.relationship))||legacyOrphanFiles.has(member.family_id);
}
export function countCaseMembers(files: CaseFile[], members: CaseFileMember[], today: string): { children: number; orphans: number } {
  const activeFileIds=new Set(files.map(file=>file.id));const legacyOrphanFiles=new Set(files.filter(file=>file.case_file_categories.some(({category})=>category===LEGACY_ORPHAN_CATEGORY)).map(file=>file.id));const children = new Map<string, boolean>();
  for (const member of members) {
    if(!activeFileIds.has(member.family_id))continue;
    const age = memberAge(member, today); if (age === null || age >= 18) continue;
    children.set(member.person_id, (children.get(member.person_id) ?? false) || isOrphan(member,legacyOrphanFiles));
  }
  return { children: children.size, orphans: [...children.values()].filter(Boolean).length };
}
export function matchesCaseDirectoryFilter(
  fileId: string, files: CaseFile[], members: CaseFileMember[], ageFilter: CaseAgeFilter, today: string,
): boolean {
  if (ageFilter === 'all') return true;
  const activeFileIds=new Set(files.map(file=>file.id));const legacyOrphanFiles=new Set(files.filter(file=>file.case_file_categories.some(({category})=>category===LEGACY_ORPHAN_CATEGORY)).map(file=>file.id));
  return members.filter((member) => member.family_id === fileId).some((member) => {
    if(!activeFileIds.has(member.family_id))return false;
    const age = memberAge(member, today); if (age === null) return false;
    if (ageFilter === 'under18') return age < 18;
    if (ageFilter === 'under21') return age < 21;
    if (ageFilter === 'elderly') return age >= 60;
    return age < 18 && isOrphan(member,legacyOrphanFiles);
  });
}
