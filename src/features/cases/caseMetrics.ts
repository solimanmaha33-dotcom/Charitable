import type { CaseFile, CaseFileMember } from '../../services/cases';
import { ageOn } from './memberAge';

export type CaseAgeFilter = 'all' | 'orphans' | 'under18' | 'under21' | 'elderly';
const ORPHAN_CATEGORIES = new Set(['يتيم الأم', 'يتيم الأب']);
function memberAge(member: CaseFileMember, today: string): number | null {
  const birthDate = member.people.date_of_birth;
  if (!birthDate) return null;
  const age = ageOn(birthDate, today);
  return Number.isInteger(age) && age >= 0 ? age : null;
}
function orphanFileIds(files: CaseFile[]): Set<string> {
  return new Set(files.filter((file) => file.case_file_categories.some(({ category }) => ORPHAN_CATEGORIES.has(category))).map((file) => file.id));
}
export function countCaseMembers(files: CaseFile[], members: CaseFileMember[], today: string): { children: number; orphans: number } {
  const orphanFiles = orphanFileIds(files); const children = new Map<string, boolean>();
  for (const member of members) {
    const age = memberAge(member, today); if (age === null || age >= 18) continue;
    children.set(member.person_id, (children.get(member.person_id) ?? false) || orphanFiles.has(member.family_id));
  }
  return { children: children.size, orphans: [...children.values()].filter(Boolean).length };
}
export function matchesCaseDirectoryFilter(
  fileId: string, files: CaseFile[], members: CaseFileMember[], ageFilter: CaseAgeFilter, today: string,
): boolean {
  if (ageFilter === 'all') return true;
  const orphanFiles = orphanFileIds(files);
  return members.filter((member) => member.family_id === fileId).some((member) => {
    const age = memberAge(member, today); if (age === null) return false;
    if (ageFilter === 'under18') return age < 18;
    if (ageFilter === 'under21') return age < 21;
    if (ageFilter === 'elderly') return age >= 60;
    return age < 18 && orphanFiles.has(fileId);
  });
}
