import { describe, expect, it } from 'vitest';
import type { FamilyMember, CaseRecord } from '../../services/cases';
import { countCaseMembers, matchesCaseDirectoryFilter } from './caseMetrics';

const cases: CaseRecord[] = [
  { id: 'c1', family_id: 'f1', notes: '', case_categories: [{ category: 'يتيم الأم' }, { category: 'أرملة' }] },
  { id: 'c2', family_id: 'f1', notes: '', case_categories: [{ category: 'يتيم الأب' }] },
  { id: 'c3', family_id: 'f2', notes: '', case_categories: [{ category: 'كبار السن (٦٠ سنة فأكثر)' }] },
];

const members: FamilyMember[] = [
  { family_id: 'f1', person_id: 'p1', relationship: 'ابن', people: { name: 'كريم', gender: 'male', date_of_birth: '2008-11-09' } },
  { family_id: 'f1', person_id: 'p2', relationship: 'بنت', people: { name: 'مريم', gender: 'female', date_of_birth: '2018-02-01' } },
  { family_id: 'f1', person_id: 'p3', relationship: 'ابن', people: { name: 'علي', gender: 'male', date_of_birth: '2006-11-08' } },
  { family_id: 'f2', person_id: 'p4', relationship: 'أب', people: { name: 'حسن', gender: 'male', date_of_birth: '1967-11-08' } },
  { family_id: 'f2', person_id: 'p5', relationship: 'أم', people: { name: 'سعاد', gender: 'female', date_of_birth: '1966-11-08' } },
  { family_id: 'f2', person_id: 'p6', relationship: 'ابن', people: { name: 'يوسف', gender: 'male', date_of_birth: null } },
];

describe('case directory metrics', () => {
  it('counts children and orphan children as people, not case rows', () => {
    expect(countCaseMembers(cases, members, '2026-11-08')).toEqual({ children: 2, orphans: 2 });
  });

  it('counts a person linked to multiple files once and still recognizes orphan status', () => {
    const shared = members.find((member) => member.person_id === 'p1')!;
    const linkedElsewhere = { ...shared, family_id: 'f2' };
    expect(countCaseMembers(cases, [linkedElsewhere, shared], '2026-11-08')).toEqual({ children: 1, orphans: 1 });
  });

  it('filters families by child, under-21, and elderly age boundaries', () => {
    expect(matchesCaseDirectoryFilter('f1', cases, members, 'under18', '', '2026-11-08')).toBe(true);
    expect(matchesCaseDirectoryFilter('f1', cases, members, 'under21', '', '2026-11-08')).toBe(true);
    expect(matchesCaseDirectoryFilter('f2', cases, members, 'under18', '', '2026-11-08')).toBe(false);
    expect(matchesCaseDirectoryFilter('f2', cases, members, 'elderly', '', '2026-11-08')).toBe(true);
  });

  it('handles exact ages 18, 21, 59, and 60 and ignores missing or future birthdays', () => {
    const edgeMembers: FamilyMember[] = [
      { family_id: '18', person_id: 'p18', relationship: 'فرد', people: { name: 'فرد', gender: null, date_of_birth: '2008-11-08' } },
      { family_id: '21', person_id: 'p21', relationship: 'فرد', people: { name: 'فرد', gender: null, date_of_birth: '2005-11-08' } },
      { family_id: '59', person_id: 'p59', relationship: 'فرد', people: { name: 'فرد', gender: null, date_of_birth: '1967-11-08' } },
      { family_id: '60', person_id: 'p60', relationship: 'فرد', people: { name: 'فرد', gender: null, date_of_birth: '1966-11-08' } },
      { family_id: 'missing', person_id: 'pm', relationship: 'فرد', people: { name: 'فرد', gender: null, date_of_birth: null } },
      { family_id: 'future', person_id: 'pf', relationship: 'فرد', people: { name: 'فرد', gender: null, date_of_birth: '2027-01-01' } },
    ];
    expect(matchesCaseDirectoryFilter('18', [], edgeMembers, 'under18', '', '2026-11-08')).toBe(false);
    expect(matchesCaseDirectoryFilter('18', [], edgeMembers, 'under21', '', '2026-11-08')).toBe(true);
    expect(matchesCaseDirectoryFilter('21', [], edgeMembers, 'under21', '', '2026-11-08')).toBe(false);
    expect(matchesCaseDirectoryFilter('59', [], edgeMembers, 'elderly', '', '2026-11-08')).toBe(false);
    expect(matchesCaseDirectoryFilter('60', [], edgeMembers, 'elderly', '', '2026-11-08')).toBe(true);
    expect(countCaseMembers([], edgeMembers, '2026-11-08')).toEqual({ children: 0, orphans: 0 });
  });

  it('filters orphan children only when the family has an orphan category', () => {
    expect(matchesCaseDirectoryFilter('f1', cases, members, 'orphans', '', '2026-11-08')).toBe(true);
    expect(matchesCaseDirectoryFilter('f2', cases, members, 'orphans', '', '2026-11-08')).toBe(false);
  });

  it('combines age and case-category filters with AND behavior', () => {
    expect(matchesCaseDirectoryFilter('f1', cases, members, 'under18', 'أرملة', '2026-11-08')).toBe(true);
    expect(matchesCaseDirectoryFilter('f1', cases, members, 'elderly', 'أرملة', '2026-11-08')).toBe(false);
    expect(matchesCaseDirectoryFilter('f2', cases, members, 'elderly', 'أرملة', '2026-11-08')).toBe(false);
  });
});
