import {expect,it} from 'vitest';
import {addDateOnlyDays,expandIdentityExpirations,groupIdExpirations,type IdExpiryRecord} from './idExpiry';

const record=(national_id_expires_on:string):IdExpiryRecord=>({id:national_id_expires_on,code:'F-1',father_name:'أب',mother_name:'أم',contact_name:null,national_id_expires_on,identity_holder:'المسؤول'});

it('groups expired, due today, and due in the next 30 days while excluding day 31',()=>{
 const groups=groupIdExpirations([record('2026-11-06'),record('2026-11-07'),record('2026-12-07'),record('2026-12-08')],'2026-11-07');
 expect(groups.expired.map(row=>row.national_id_expires_on)).toEqual(['2026-11-06']);
 expect(groups.upcoming.map(row=>row.daysLeft)).toEqual([0,30]);
});

it('adds calendar days to date-only values without month or year drift',()=>{
 expect(addDateOnlyDays('2026-12-31',30)).toBe('2027-01-30');
});

it('creates a separate reminder for every adult identity with an expiry date',()=>{
 const rows=expandIdentityExpirations([{
  id:'case-1',code:'F-1',father_name:'أب',mother_name:'أم',contact_name:'مسؤول',
  national_id_expires_on:'2026-12-01',father_national_id_expires_on:'2026-11-10',mother_national_id_expires_on:'2027-01-01',
 }],'2027-01-01');
 expect(rows.map(row=>[row.identity_holder,row.national_id_expires_on])).toEqual([
  ['الأب','2026-11-10'],['المسؤول','2026-12-01'],['الأم','2027-01-01'],
 ]);
});
