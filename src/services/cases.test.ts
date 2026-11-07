import { expect, it, vi } from 'vitest';
import { countCases, countFamilies, getCase, getFamily, listCases, listFamilies } from './cases';
const rows = vi.hoisted(() => ({
 selects: [] as {table:string;columns:string;options:unknown}[],
 families: Array.from({length:1001},(_,i)=>({id:`f${i}`,code:`F-${i}`,name:`Family ${i}`,phone:null})),
 cases: Array.from({length:1001},(_,i)=>({id:`c${i}`,family_id:`f${i}`,notes:'',case_categories:[]})),
}));
vi.mock('./supabase',()=>({getSupabase:()=>({from:(table: 'families'|'cases')=>{
 let data=rows[table] as {id:string}[]; let start=0,end=999;let head=false;
 const query={select:(columns='*',options?:unknown)=>{rows.selects.push({table,columns,options});head=!!(options as {head?:boolean}|undefined)?.head;return query;},order:()=>query,eq:(column:string,value:string)=>{data=data.filter(row=>(row as unknown as Record<string,unknown>)[column]===value);return query;},range:(a:number,b:number)=>{start=a;end=b;return query;},maybeSingle:async()=>({data:data[0]??null,error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(head?{count:data.length,error:null}:{data:data.slice(start,end+1),error:null}).then(resolve)};
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
it('uses exact counts without loading family or case rows',async()=>{
 rows.selects.length=0;
 expect(await countFamilies()).toBe(1001);
 expect(await countCases()).toBe(1001);
 expect(rows.selects).toEqual([
  {table:'families',columns:'id',options:{count:'exact',head:true}},
  {table:'cases',columns:'id',options:{count:'exact',head:true}},
 ]);
});
