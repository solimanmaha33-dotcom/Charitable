import { beforeEach, expect, it, vi } from 'vitest';
import { addMember, archiveCaseFile, countCaseFiles, getCaseFile, listAgeThresholdMembers, listAllMembers, listArchivedCaseFiles, listCaseAttachments, listCaseFileHistory, listCaseFiles, listCaseFilesByIds, listCaseFileIdExpirationsBy, restoreCaseFile, saveCaseFile, updateMemberDemographics } from './cases';

const rows = vi.hoisted(() => ({
  selects: [] as {table:string;columns:string;options:unknown}[],
  filters: [] as {table:string;method:string;column:string;value:unknown}[],
  rpc: [] as {name:string;args:Record<string,unknown>}[],
  writes: [] as {table:string;mode:string;values:Record<string,unknown>}[],
  families: [...Array.from({length:1001},(_,i)=>({id:`f${i}`,code:`F-${i}`,archived_at:null,phone:null,phone_2:null,phone_3:null,father_name:'أب',mother_name:'أم',contact_name:null,contact_relationship:null,contact_age:null,national_id_expires_on:null,notes:'',address:'عنوان',monthly_income:null,health_condition:null,branch_area:null,file_status:'تحت المراجعة',status_reason:null,case_file_categories:[]})),{id:'archived',code:'F-ARCHIVED',archived_at:'2026-11-01T00:00:00Z',case_file_categories:[]}],
  case_attachments: [{id:'file-1',family_id:'f1',storage_path:'f1/file-1',file_name:'test.png',mime_type:'image/png',size_bytes:5,uploaded_by:'staff-1',extracted_text:null,created_at:'2026-11-07'}],
  case_file_history: [{id:'old-1',family_id:'f1',legacy_case_id:'legacy-1',notes:'قديم',created_at:'2026-11-08',source:'قديم'}],
  legacy_case_map: [{legacy_case_id:'legacy-1',family_id:'f1'}],
  family_members: [{family_id:'f1',person_id:'p1',relationship:'بنت',people:{name:'ريم',gender:'female',date_of_birth:'2008-12-31'},case_file:{father_name:'أب',mother_name:'أم',code:'F-0001',archived_at:null}}],
  people: [{id:'p1',name:'ريم',gender:'female',date_of_birth:'2008-12-31'}],
}));
vi.mock('./supabase',()=>({getSupabase:()=>({rpc:async(name:string,args:Record<string,unknown>)=>{rows.rpc.push({name,args});return {data:'file-new',error:null};},from:(table:string)=>{
  let data=(rows as unknown as Record<string,{id:string}[]>)[table] ?? [];let start=0,end=999;let head=false;
  const query={select:(columns='*',options?:unknown)=>{rows.selects.push({table,columns,options});head=!!(options as {head?:boolean}|undefined)?.head;return query;},insert:(values:Record<string,unknown>)=>{rows.writes.push({table,mode:'insert',values});return query;},update:(values:Record<string,unknown>)=>{rows.writes.push({table,mode:'update',values});return query;},order:()=>query,eq:(column:string,value:string)=>{rows.filters.push({table,method:'eq',column,value});data=data.filter(row=>(row as unknown as Record<string,unknown>)[column]===value);return query;},in:(column:string,value:string[])=>{rows.filters.push({table,method:'in',column,value});data=data.filter(row=>value.includes(String((row as unknown as Record<string,unknown>)[column])));return query;},is:(column:string,value:unknown)=>{rows.filters.push({table,method:'is',column,value});if(!column.includes('.'))data=data.filter(row=>(row as unknown as Record<string,unknown>)[column]===value);return query;},not:(column:string,operator:string,value:unknown)=>{rows.filters.push({table,method:'not',column,value});if(operator==='is'&&value===null)data=data.filter(row=>(row as unknown as Record<string,unknown>)[column]!==null&&(row as unknown as Record<string,unknown>)[column]!==undefined);return query;},lte:(column:string,value:string)=>{data=data.filter(row=>String((row as unknown as Record<string,unknown>)[column]??'')<=value);return query;},range:(a:number,b:number)=>{start=a;end=b;return query;},single:async()=>({data:{id:'file-new'},error:null}),maybeSingle:async()=>({data:data[0]??null,error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(head?{count:data.length,error:null}:{data:data.slice(start,end+1),error:null}).then(resolve)};return query;
}})}));

beforeEach(()=>{rows.rpc.length=0;rows.selects.length=0;rows.filters.length=0;rows.writes.length=0;});

it('retrieves case-file lists beyond the API row limit and counts the same unified files',async()=>{
 expect(await listCaseFiles()).toHaveLength(1001); expect(await countCaseFiles()).toBe(1001);
 expect(rows.selects.at(-1)).toEqual({table:'families',columns:'id',options:{count:'exact',head:true}});
 expect(rows.filters.filter(filter=>filter.column==='archived_at')).toHaveLength(4);
});
it('loads one file with new fields but excludes national ID from list queries',async()=>{
 rows.selects.length=0; await listCaseFiles();
 expect(rows.selects[0]?.table).toBe('families');expect(rows.selects[0]?.columns).toContain('case_file_categories(category)');
 expect(rows.selects[0]?.columns).toContain('file_status');expect(rows.selects[0]?.columns).toContain('address');expect(rows.selects[0]?.columns).not.toContain(',name,');expect(rows.selects[0]?.columns).not.toContain(',national_id,');
 expect((await getCaseFile('f1'))?.id).toBe('f1');
});
it('keeps archived files out of details and active lists but resolves existing links by ID',async()=>{
 expect(await getCaseFile('archived')).toBeNull();
 const linked=await listCaseFilesByIds(['archived']);
 expect(linked[0]).toMatchObject({id:'archived',archived_at:'2026-11-01T00:00:00Z'});
 expect(rows.filters).toContainEqual({table:'families',method:'in',column:'id',value:['archived']});
 expect(rows.selects.at(-1)?.columns).toContain('archived_at');
});
it('saves one unified profile and its categories through the atomic RPC',async()=>{
 const id=await saveCaseFile(null,{fatherName:'أب',motherName:'أم',contactName:'مسؤول',contactRelationship:'الأم',contactAge:42,nationalId:'29001011234567',nationalIdExpiresOn:'2027-01-15',phones:['0101','','0103'],notes:'ملاحظة',address:'عنوان',monthlyIncome:500,healthCondition:'مستقرة',branchArea:'فرع',fileStatus:'موقوف',statusReason:'مراجعة الأوراق',categories:['هجر']});
 expect(id).toBe('file-new');expect(rows.rpc.at(-1)?.name).toBe('save_case_file');expect(rows.rpc.at(-1)?.args).toMatchObject({p_id:null,p_categories:['هجر'],p_profile:{father_name:'أب',mother_name:'أم',phone:'0101',phone_2:null,phone_3:'0103',address:'عنوان',monthly_income:500,health_condition:'مستقرة',branch_area:'فرع',file_status:'موقوف',status_reason:'مراجعة الأوراق'}});
});
it('rejects a new file without a mother name and a negative income before the database call',async()=>{
 const base={fatherName:'',motherName:'أم',contactName:'',contactRelationship:'',contactAge:null,nationalId:'',nationalIdExpiresOn:'',phones:[],notes:'',address:'',monthlyIncome:null,healthCondition:'',branchArea:'',fileStatus:'تحت المراجعة' as const,statusReason:'',categories:[]};
 await expect(saveCaseFile(null,{...base,motherName:''})).rejects.toThrow('اسم الأم مطلوب');
 await expect(saveCaseFile(null,{...base,monthlyIncome:-1})).rejects.toThrow('الدخل الشهري غير صحيح');
 expect(rows.rpc).toHaveLength(0);
});
it('requires a reason for held and rejected statuses',async()=>{
 const base={fatherName:'',motherName:'أم',contactName:'',contactRelationship:'',contactAge:null,nationalId:'',nationalIdExpiresOn:'',phones:[],notes:'',address:'',monthlyIncome:null,healthCondition:'',branchArea:'',statusReason:'',categories:[]};
 for(const fileStatus of ['موقوف','مرفوض'] as const) await expect(saveCaseFile(null,{...base,fileStatus})).rejects.toThrow('سبب الإيقاف أو الرفض مطلوب');
});
it('loads private attachments, saved history and safe expiry fields for the same file',async()=>{
 expect(await listCaseAttachments('f1')).toHaveLength(1);expect(rows.selects.at(-1)?.table).toBe('case_attachments');
 expect(await listCaseFileHistory('f1')).toHaveLength(1);expect(rows.selects.at(-1)?.table).toBe('case_file_history');
 rows.selects.length=0;await listCaseFileIdExpirationsBy('2027-01-15');expect(rows.selects.at(-1)?.columns).not.toContain('national_id,');expect(rows.filters).toContainEqual({table:'families',method:'is',column:'archived_at',value:null});
});
it('adds and updates household members through the permission-checked functions',async()=>{
 rows.rpc.length=0;await addMember('f1','ريم','بنت','female','2008-12-31');
 expect(rows.rpc).toEqual([{name:'add_family_member_profile',args:{p_family_id:'f1',p_name:'ريم',p_relationship:'بنت',p_gender:'female',p_date_of_birth:'2008-12-31'}}]);
 rows.writes.length=0;await updateMemberDemographics('p1','female','2008-12-31');expect(rows.writes).toEqual([{table:'people',mode:'update',values:{gender:'female',date_of_birth:'2008-12-31'}}]);
 expect(await listAllMembers()).toHaveLength(1);
 expect(rows.filters).toContainEqual({table:'family_members',method:'is',column:'case_file.archived_at',value:null});
});
it('excludes archived members from age threshold reminders',async()=>{
 await listAgeThresholdMembers();
 expect(rows.selects.at(-1)?.columns).toContain('families!inner');
 expect(rows.filters).toContainEqual({table:'family_members',method:'is',column:'case_file.archived_at',value:null});
});
it('lists archived case summaries and calls the protected archive and restore RPCs',async()=>{
 const archived=await listArchivedCaseFiles();
 expect(archived).toEqual([expect.objectContaining({id:'archived',archived_at:'2026-11-01T00:00:00Z'})]);
 expect(rows.filters.at(-1)).toEqual({table:'families',method:'not',column:'archived_at',value:null});
 await archiveCaseFile('f1');await restoreCaseFile('f1');
 expect(rows.rpc.slice(-2)).toEqual([
  {name:'archive_case_file',args:{p_id:'f1'}},
  {name:'restore_case_file',args:{p_id:'f1'}},
 ]);
});
