import {expect,it} from 'vitest';
import {addDateOnlyDays,groupIdExpirations,type IdExpiryRecord} from './idExpiry';

const record=(national_id_expires_on:string):IdExpiryRecord=>({id:national_id_expires_on,code:'F-1',father_name:'أب',mother_name:'أم',contact_name:null,national_id_expires_on});

it('groups expired, due today, and due in the next 90 days',()=>{
 const groups=groupIdExpirations([record('2026-11-06'),record('2026-11-07'),record('2027-02-05'),record('2027-02-06')],'2026-11-07');
 expect(groups.expired.map(row=>row.national_id_expires_on)).toEqual(['2026-11-06']);
 expect(groups.upcoming.map(row=>row.daysLeft)).toEqual([0,90]);
});

it('adds calendar days to date-only values without month or year drift',()=>{
 expect(addDateOnlyDays('2026-12-31',90)).toBe('2027-03-31');
});
