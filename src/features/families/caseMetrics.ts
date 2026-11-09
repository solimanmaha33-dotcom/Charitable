import type { CaseCategory } from '../cases/categories';
import type { CaseRecord, FamilyMember } from '../../services/cases';
import { ageOn } from './memberAge';

export type CaseAgeFilter = 'all' | 'orphans' | 'under18' | 'under21' | 'elderly';

const ORPHAN_CATEGORIES = new Set(['يتيم الأم', 'يتيم الأب']);

function memberAge(member: FamilyMember, today: string): number | null {
  const birthDate = member.people.date_of_birth;
  if (!birthDate) return null;
  const age = ageOn(birthDate, today);
  return Number.isInteger(age) && age >= 0 ? age : null;
}

function orphanFamilyIds(cases: CaseRecord[]): Set<string> {
  return new Set(cases
    .filter((record) => record.case_categories.some(({ category }) => ORPHAN_CATEGORIES.has(category)))
    .map((record) => record.family_id));
}

export function countCaseMembers(cases: CaseRecord[], members: FamilyMember[], today: string): { children: number; orphans: number } {
  const orphanFamilies = orphanFamilyIds(cases);
  const children = new Map<string, boolean>();

  for (const member of members) {
    const age = memberAge(member, today);
    if (age === null || age >= 18) continue;
    children.set(member.person_id, (children.get(member.person_id) ?? false) || orphanFamilies.has(member.family_id));
  }

  return { children: children.size, orphans: [...children.values()].filter(Boolean).length };
}

export function matchesCaseDirectoryFilter(
  familyId: string,
  cases: CaseRecord[],
  members: FamilyMember[],
  ageFilter: CaseAgeFilter,
  category: CaseCategory | '',
  today: string,
): boolean {
  const familyCases = cases.filter((record) => record.family_id === familyId);
  if (category && !familyCases.some((record) => record.case_categories.some((item) => item.category === category))) return false;
  if (ageFilter === 'all') return true;

  const familyMembers = members.filter((member) => member.family_id === familyId);
  return familyMembers.some((member) => {
    const age = memberAge(member, today);
    if (age === null) return false;
    if (ageFilter === 'under18') return age < 18;
    if (ageFilter === 'under21') return age < 21;
    if (ageFilter === 'elderly') return age >= 60;
    return age < 18 && orphanFamilyIds(familyCases).size > 0;
  });
}
