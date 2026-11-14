import {expect,it} from 'vitest';
import {monthlyDisbursementSummary} from './monthlyDisbursementSummary';

it('totals only active help recorded in the current Cairo month',()=>{
 expect(monthlyDisbursementSummary([
  {amount:500.25,disbursed_on:'2026-11-01',is_voided:false},
  {amount:200,disbursed_on:'2026-11-08',is_voided:false},
  {amount:900,disbursed_on:'2026-11-09',is_voided:true},
  {amount:1000,disbursed_on:'2026-10-31',is_voided:false},
 ],'2026-11-09')).toEqual({count:2,total:700.25});
});

it('returns an empty total when there is no active current-month help',()=>expect(monthlyDisbursementSummary([{amount:10,disbursed_on:'2026-10-31',is_voided:false},{amount:20,disbursed_on:'2026-11-01',is_voided:true}],'2026-11-09')).toEqual({count:0,total:0}));
