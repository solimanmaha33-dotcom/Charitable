import { describe, expect, it } from 'vitest';
import type { CaseFile, CaseFileMember } from '../../services/cases';
import { countCaseMembers, matchesCaseDirectoryFilter } from './caseMetrics';

function file(id:string,categories:string[]=[]):CaseFile{return {id,code:`F-${id}`,phone:null,phone_2:null,phone_3:null,father_name:null,mother_name:null,contact_name:null,contact_relationship:null,contact_age:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'نشط',status_reason:null,national_id_expires_on:null,case_file_categories:categories.map(category=>({category:category as CaseFile['case_file_categories'][number]['category']}))};}
const files=[file('f1',['يتيم الأم','أرملة']),file('f2',['كبار السن (٦٠ سنة فأكثر)'])];
const members:CaseFileMember[]=[
 {family_id:'f1',person_id:'p1',relationship:'ابن',people:{name:'كريم',gender:'male',date_of_birth:'2008-11-09'}},
 {family_id:'f1',person_id:'p2',relationship:'بنت',people:{name:'مريم',gender:'female',date_of_birth:'2018-02-01'}},
 {family_id:'f1',person_id:'p3',relationship:'ابن',people:{name:'علي',gender:'male',date_of_birth:'2006-11-08'}},
 {family_id:'f2',person_id:'p4',relationship:'أب',people:{name:'حسن',gender:'male',date_of_birth:'1967-11-08'}},
 {family_id:'f2',person_id:'p5',relationship:'أم',people:{name:'سعاد',gender:'female',date_of_birth:'1966-11-08'}},
 {family_id:'f2',person_id:'p6',relationship:'ابن',people:{name:'يوسف',gender:'male',date_of_birth:null}},
];
describe('case file metrics',()=>{
 it('counts children and orphan children as distinct people',()=>expect(countCaseMembers(files,members,'2026-11-08')).toEqual({children:2,orphans:2}));
 it('counts a person linked to multiple case files once',()=>{const shared=members[0]!;expect(countCaseMembers(files,[shared,{...shared,family_id:'f2'}],'2026-11-08')).toEqual({children:1,orphans:1});});
 it('filters by age and orphan status',()=>{
  expect(matchesCaseDirectoryFilter('f1',files,members,'under18','2026-11-08')).toBe(true);
  expect(matchesCaseDirectoryFilter('f1',files,members,'under21','2026-11-08')).toBe(true);
  expect(matchesCaseDirectoryFilter('f2',files,members,'under18','2026-11-08')).toBe(false);
  expect(matchesCaseDirectoryFilter('f2',files,members,'elderly','2026-11-08')).toBe(true);
  expect(matchesCaseDirectoryFilter('f1',files,members,'orphans','2026-11-08')).toBe(true);
  expect(matchesCaseDirectoryFilter('f2',files,members,'orphans','2026-11-08')).toBe(false);
 });
 it('handles exact ages 18, 21, 59, 60 and missing birthdays',()=>{
  const edgeFiles=['18','21','59','60','missing','future'].map(id=>file(id));
  const edgeMembers:CaseFileMember[]=[['18','2008-11-08'],['21','2005-11-08'],['59','1967-11-08'],['60','1966-11-08'],['missing',null],['future','2027-01-01']].map(([id,dob])=>({family_id:id!,person_id:`p${id}`,relationship:'فرد',people:{name:'فرد',gender:null,date_of_birth:dob}}));
  expect(matchesCaseDirectoryFilter('18',edgeFiles,edgeMembers,'under18','2026-11-08')).toBe(false);
  expect(matchesCaseDirectoryFilter('18',edgeFiles,edgeMembers,'under21','2026-11-08')).toBe(true);
  expect(matchesCaseDirectoryFilter('21',edgeFiles,edgeMembers,'under21','2026-11-08')).toBe(false);
  expect(matchesCaseDirectoryFilter('59',edgeFiles,edgeMembers,'elderly','2026-11-08')).toBe(false);
  expect(matchesCaseDirectoryFilter('60',edgeFiles,edgeMembers,'elderly','2026-11-08')).toBe(true);
  expect(countCaseMembers(edgeFiles,edgeMembers,'2026-11-08')).toEqual({children:0,orphans:0});
 });
});
