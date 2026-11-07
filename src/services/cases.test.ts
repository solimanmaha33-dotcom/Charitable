import { expect, it, vi } from 'vitest';
import { countCases, countFamilies, getCase, getFamily, listCases, listFamilies, listFamilyFiles, saveFamily } from './cases';
const rows = vi.hoisted(() => ({
 selects: [] as {table:string;columns:string;options:unknown}[],
  writes: [] as {table:string;mode:string;values:Record<string,unknown>}[],
 families: Array.from({length:1001},(_,i)=>({id:`f${i}`,code:`F-${i}`,name:`Family ${i}`,phone:null})),
 cases: Array.from({length:1001},(_,i)=>({id:`c${i}`,family_id:`f${i}`,notes:'',case_categories:[]})),
  family_files: [{id:'file-1',family_id:'f1',storage_path:'f1/file-1',file_name:'test.png',mime_type:'image/png',size_bytes:5,uploaded_by:'staff-1',created_at:'2026-11-07'}],
}));
vi.mock('./supabase',()=>({getSupabase:()=>({from:(table: 'families'|'cases'|'family_files')=>{
 let data=rows[table] as {id:string}[]; let start=0,end=999;let head=false;
 const query={select:(columns='*',options?:unknown)=>{rows.selects.push({table,columns,options});head=!!(options as {head?:boolean}|undefined)?.head;return query;},insert:(values:Record<string,unknown>)=>{rows.writes.push({table,mode:'insert',values});return query;},update:(values:Record<string,unknown>)=>{rows.writes.push({table,mode:'update',values});return query;},order:()=>query,eq:(column:string,value:string)=>{data=data.filter(row=>(row as unknown as Record<string,unknown>)[column]===value);return query;},range:(a:number,b:number)=>{start=a;end=b;return query;},single:async()=>({data:{id:'family-new'},error:null}),maybeSingle:async()=>({data:data[0]??null,error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(head?{count:data.length,error:null}:{data:data.slice(start,end+1),error:null}).then(resolve)};
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
it('loads only directory fields and all three phones, not national IDs',async()=>{
 rows.selects.length=0;
 await listFamilies();
 expect(rows.selects[0]).toEqual({table:'families',columns:'id,code,name,phone,phone_2,phone_3',options:undefined});
 expect(rows.selects[0].columns).not.toContain('national_id');
});
it('writes all supported family profile fields without replacing the family code',async()=>{
 rows.writes.length=0;
 await saveFamily(null,{name:'أسرة',contactName:'مسؤول',contactAge:42,nationalId:'29001011234567',phones:['0101','','0103'],notes:'ملاحظة'});
 expect(rows.writes).toEqual([{table:'families',mode:'insert',values:{name:'أسرة',phone:'0101',contact_name:'مسؤول',contact_age:42,national_id:'29001011234567',phone_2:null,phone_3:'0103',notes:'ملاحظة'}}]);
});
it('lists family attachments for the requested family in creation order',async()=>{
 const files=await listFamilyFiles('f1');
 expect(files).toHaveLength(1);
 expect(rows.selects.at(-1)).toEqual({table:'family_files',columns:'*',options:undefined});
});
