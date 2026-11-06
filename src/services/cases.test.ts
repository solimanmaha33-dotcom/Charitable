import { expect, it, vi } from 'vitest';
import { getCase, getFamily, listCases, listFamilies } from './cases';
const rows = vi.hoisted(() => ({
 families: Array.from({length:1001},(_,i)=>({id:`f${i}`,code:`F-${i}`,name:`Family ${i}`,phone:null})),
 cases: Array.from({length:1001},(_,i)=>({id:`c${i}`,family_id:`f${i}`,notes:'',case_categories:[]})),
}));
vi.mock('./supabase',()=>({getSupabase:()=>({from:(table: 'families'|'cases')=>{
 let data=rows[table] as {id:string}[]; let start=0,end=999;
 const query={select:()=>query,order:()=>query,eq:(column:string,value:string)=>{data=data.filter(row=>(row as unknown as Record<string,unknown>)[column]===value);return query;},range:(a:number,b:number)=>{start=a;end=b;return query;},maybeSingle:async()=>({data:data[0]??null,error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:data.slice(start,end+1),error:null}).then(resolve)};
 return query;
}})}));
it('retrieves lists beyond the API row limit',async()=>{
 expect(await listFamilies()).toHaveLength(1001);
 expect(await listCases()).toHaveLength(1001);
});
it('looks up family and case details by ID',async()=>{
 expect((await getFamily('f1000'))?.id).toBe('f1000');
 expect((await getCase('c1000'))?.id).toBe('c1000');
 expect(await getFamily('missing')).toBeNull();
});
