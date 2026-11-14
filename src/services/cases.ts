import { getSupabase } from './supabase';
import { validateDocument, openPdf } from '../features/files/documentText';
import { hasConflictingCaseCategories, isCaseCategory, type StoredCaseCategory } from '../features/cases/categories';
import type { MemberGender } from '../features/cases/memberDemographics';
import { normalizeEgyptianNationalIdInput, parseEgyptianNationalId } from '../features/cases/nationalIdScan';
import { hasAdultCaseIdentity, hasValidNationalIdForExpiry } from '../features/cases/caseIdentity';
import { sanitizeCaseFileInput, visibleCaseIdentityCandidates } from '../features/cases/caseProfileVisibility';
import { HEALTH_STATUSES, type HealthStatus } from '../features/cases/healthStatus';
import { cairoToday } from '../shared/cairoDate';

export type CaseFileStatus = 'نشط' | 'موقوف' | 'تحت المراجعة' | 'مرفوض';
export type EmploymentStatus = 'يعمل' | 'لا يعمل' | 'طفل' | 'طفلة';
export type CaseFileInput = {
 fatherName: string; motherName: string; contactName: string; contactRelationship: string; contactAge: number | null;
 nationalId: string; nationalIdExpiresOn: string; phones: string[]; notes: string; address: string;
 monthlyIncome: number | null; healthCondition: string; branchArea: string; fileStatus: CaseFileStatus;
 statusReason: string; categories: StoredCaseCategory[]; fatherNationalId?: string; motherNationalId?: string; fatherNationalIdExpiresOn?: string; motherNationalIdExpiresOn?: string;
 fatherHealthCondition?: string; motherHealthCondition?: string; fatherHealthStatus?: HealthStatus; motherHealthStatus?: HealthStatus;
 fatherEmploymentStatus?: EmploymentStatus | null; motherEmploymentStatus?: EmploymentStatus | null; fatherOccupation?: string; motherOccupation?: string;
 fatherDateOfBirth?: string; fatherGender?: MemberGender | null; motherDateOfBirth?: string; motherGender?: MemberGender | null;
 contactDateOfBirth?: string; contactGender?: MemberGender | null;
 nextReviewDate?:string;
};
export type CaseFile = {
 id: string; code: string; phone: string | null; phone_2: string | null; phone_3: string | null;
 archived_at: string | null;
 father_name: string | null; mother_name: string | null; contact_name: string | null; contact_relationship: string | null;
 father_national_id?: string | null; mother_national_id?: string | null; father_national_id_expires_on?: string | null; mother_national_id_expires_on?: string | null; father_health_condition?: string | null; mother_health_condition?: string | null;
 father_health_status?: HealthStatus | null; mother_health_status?: HealthStatus | null;
 father_employment_status?: EmploymentStatus | null; mother_employment_status?: EmploymentStatus | null; father_occupation?: string | null; mother_occupation?: string | null;
 father_date_of_birth?: string | null; father_gender?: MemberGender | null; mother_date_of_birth?: string | null; mother_gender?: MemberGender | null;
 contact_date_of_birth?: string | null; contact_gender?: MemberGender | null;
 contact_age: number | null; national_id?: string | null; national_id_expires_on: string | null; notes: string;
 address: string | null; monthly_income: number | null; health_condition: string | null; branch_area: string | null;
 file_status: CaseFileStatus; status_reason: string | null; case_file_categories: { category: StoredCaseCategory }[];
 next_review_date?:string|null;
};
export type CaseFileSummary = Pick<CaseFile,'id'|'code'|'phone'|'phone_2'|'phone_3'|'father_name'|'mother_name'|'address'|'branch_area'|'file_status'|'archived_at'>;
export type ArchivedCaseFile = Omit<CaseFileSummary,'archived_at'> & {archived_at:string};
export type CaseFileIdExpiry = { id:string; code:string; father_name:string|null; mother_name:string|null; contact_name:string|null; national_id_expires_on:string; identity_holder:string };
export type Member = { person_id: string; relationship: string; father_status?:'الأب موجود'|'يتيم الأب'|null; people: { name: string; gender:MemberGender|null; date_of_birth:string|null; national_id?:string|null; health_condition?:string|null; health_status?:HealthStatus|null; health_details?:string|null; employment_status?:EmploymentStatus|null; occupation?:string|null } };
export type CaseFileMember = Member & { family_id: string };
export type MemberAgeProfile=CaseFileMember & {case_file:{father_name:string|null;mother_name:string|null;code:string}};
export type CaseAttachmentDocumentType='general'|'social_research';
export type CaseAttachment = { id:string; family_id:string; storage_path:string; file_name:string; mime_type:string; size_bytes:number; uploaded_by:string; extracted_text:string|null; created_at:string; document_type:CaseAttachmentDocumentType };
export type CaseFileHistory = { id:string; family_id:string; legacy_case_id:string; notes:string; created_at:string; source:string };
export type FamilyFile = CaseAttachment;
function db() { const client = getSupabase(); if (!client) throw new Error('مش قادرين نتصل بقاعدة البيانات. اتأكد من الاتصال وجرب تاني.'); return client; }
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
async function countRows(table: 'families'): Promise<number> {
 const {count,error}=await db().from(table).select('id',{count:'exact',head:true}).is('archived_at',null);
 check(error); if(count===null) throw new Error('ماقدرناش نحمّل العدد. حدّث الصفحة وجرب تاني.'); return count;
}
const PAGE_SIZE = 500;
async function allPages<T>(fetchPage: (start: number, end: number) => PromiseLike<{data: T[] | null; error: {message:string} | null}>): Promise<T[]> {
 const result: T[]=[];
 for (let start=0;;start+=PAGE_SIZE) {
  const {data,error}=await fetchPage(start,start+PAGE_SIZE-1); check(error);
  const page=data ?? []; result.push(...page); if (page.length<PAGE_SIZE) return result;
 }
}
const CASE_FILE_LIST_COLUMNS='id,code,phone,phone_2,phone_3,father_name,mother_name,father_national_id,mother_national_id,father_national_id_expires_on,mother_national_id_expires_on,contact_name,contact_relationship,contact_age,national_id_expires_on,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason,archived_at,case_file_categories(category)';
const CASE_FILE_LIST_COLUMNS_WITH_REVIEW=CASE_FILE_LIST_COLUMNS.replace('national_id_expires_on,notes','national_id_expires_on,next_review_date,notes');
const CASE_FILE_DETAIL_COLUMNS=CASE_FILE_LIST_COLUMNS_WITH_REVIEW.replace('contact_age,national_id_expires_on','father_date_of_birth,father_gender,mother_date_of_birth,mother_gender,contact_date_of_birth,contact_gender,father_health_condition,mother_health_condition,father_health_status,mother_health_status,father_employment_status,mother_employment_status,father_occupation,mother_occupation,contact_age,national_id,national_id_expires_on');
async function listCaseFileProfiles(): Promise<CaseFile[]> {
 return allPages((start,end)=>db().from('families').select(CASE_FILE_LIST_COLUMNS_WITH_REVIEW).is('archived_at',null).order('id').range(start,end)) as unknown as Promise<CaseFile[]>;
}
export async function listCaseFiles():Promise<CaseFile[]>{return listCaseFileProfiles();}
export async function getCaseFile(id:string):Promise<CaseFile|null>{
 const {data,error}=await db().from('families').select(CASE_FILE_DETAIL_COLUMNS).eq('id',id).is('archived_at',null).maybeSingle();check(error);return data as CaseFile|null;
}
export async function listCaseFilesByIds(ids:string[]):Promise<CaseFileSummary[]> {
 if(!ids.length)return [];
 return allPages((start,end)=>db().from('families').select('id,code,phone,phone_2,phone_3,father_name,mother_name,address,branch_area,file_status,archived_at').in('id',ids).order('id').range(start,end)) as Promise<CaseFileSummary[]>;
}
export async function listArchivedCaseFiles():Promise<ArchivedCaseFile[]> {
 return allPages((start,end)=>db().from('families').select('id,code,phone,phone_2,phone_3,father_name,mother_name,address,branch_area,file_status,archived_at').not('archived_at','is',null).order('archived_at',{ascending:false}).order('id').range(start,end)) as Promise<ArchivedCaseFile[]>;
}
export async function archiveCaseFile(id:string):Promise<void> {
 const {error}=await db().rpc('archive_case_file',{p_id:id});check(error);
}
export async function restoreCaseFile(id:string):Promise<void> {
 const {error}=await db().rpc('restore_case_file',{p_id:id});check(error);
}
export async function findCaseFileForLegacyId(id:string):Promise<string|null>{
 const {data,error}=await db().from('legacy_case_map').select('family_id').eq('legacy_case_id',id).maybeSingle();check(error);return (data as {family_id:string}|null)?.family_id??null;
}
export async function listCaseFileHistory(caseFileId:string):Promise<CaseFileHistory[]>{
 return allPages((start,end)=>db().from('case_file_history').select('*').eq('family_id',caseFileId).order('created_at',{ascending:false}).range(start,end));
}
function validateInput(input:CaseFileInput,requireMother:boolean){
 if(requireMother&&!input.motherName.trim())throw new Error('اسم الأم مطلوب');
 if(!['نشط','موقوف','تحت المراجعة','مرفوض'].includes(input.fileStatus))throw new Error('اختار حالة ملف من الاختيارات.');
 if((input.fileStatus==='موقوف'||input.fileStatus==='مرفوض')&&!input.statusReason.trim())throw new Error('اكتب سبب الإيقاف أو الرفض.');
 if(input.monthlyIncome!==null&&(!Number.isFinite(input.monthlyIncome)||!Number.isInteger(input.monthlyIncome)||input.monthlyIncome<0))throw new Error('اكتب دخل شهري صحيح.');
 if(input.nextReviewDate&&!/^\d{4}-\d{2}-\d{2}$/.test(input.nextReviewDate))throw new Error('اكتب ميعاد إعادة بحث صحيح.');
 if(input.nextReviewDate){const date=new Date(`${input.nextReviewDate}T00:00:00Z`);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==input.nextReviewDate)throw new Error('اكتب ميعاد إعادة بحث صحيح.');}
 if(input.categories.some((category)=>!isCaseCategory(category)))throw new Error('اختار نوع حالة من الاختيارات.');
 if(hasConflictingCaseCategories(input.categories))throw new Error('اختار نوع واحد بس من هجر أو أرملة أو مطلقة');
 for(const id of [input.nationalId,input.fatherNationalId??'',input.motherNationalId??'']) if(id.trim()&&!parseEgyptianNationalId(id,cairoToday()))throw new Error('الرقم القومي لازم يكون ١٤ رقم وتاريخ الميلاد فيه صحيح');
 if(!hasValidNationalIdForExpiry(input.nationalId,input.nationalIdExpiresOn,cairoToday())
  ||!hasValidNationalIdForExpiry(input.fatherNationalId,input.fatherNationalIdExpiresOn,cairoToday())
  ||!hasValidNationalIdForExpiry(input.motherNationalId,input.motherNationalIdExpiresOn,cairoToday()))throw new Error('سجّل رقم قومي صحيح قبل تاريخ انتهاء البطاقة لكل شخص.');
 const phones=input.phones.map((phone)=>phone.trim());
 if(!phones.some(Boolean))throw new Error('اكتب رقم موبايل أو رقم منزل واحد على الأقل');
 if(phones.slice(0,2).some((phone)=>phone&&!/^\d{11}$/.test(phone)))throw new Error('رقم الموبايل لازم يكون ١١ رقم');
 if(phones[2]&&!/^\d{10}$/.test(phones[2]))throw new Error('رقم المنزل لازم يكون ١٠ أرقام');
 if(phones.slice(3).some(Boolean))throw new Error('مسموح برقمَي موبايل ورقم منزل فقط');
 if(!hasAdultCaseIdentity(visibleCaseIdentityCandidates(input),cairoToday()))throw new Error('لازم تسجل رقم قومي صحيح لبالغ عمره ١٨ سنة على الأقل: الأب أو الأم أو المسؤول.');
 for(const [status,details] of [[input.fatherHealthStatus,input.fatherHealthCondition],[input.motherHealthStatus,input.motherHealthCondition]]) {
  if(status&&!HEALTH_STATUSES.some((option)=>option===status))throw new Error('اختار حالة صحية من الاختيارات.');
  if(status&&status!=='حالة مستقرة'&&!details?.trim())throw new Error('اكتب نوع العجز أو المرض');
 }
 for(const [status,occupation] of [[input.fatherEmploymentStatus,input.fatherOccupation],[input.motherEmploymentStatus,input.motherOccupation]]) validateEmployment(status,occupation);
}
const employmentStatuses:EmploymentStatus[]=['يعمل','لا يعمل','طفل','طفلة'];
function validateEmployment(status:string|null|undefined,occupation:string|null|undefined){
 if(status&&!employmentStatuses.some((option)=>option===status))throw new Error('اختار حالة عمل من الاختيارات.');
 if(occupation&&occupation.length>200)throw new Error('نوع العمل لازم يكون ٢٠٠ حرف أو أقل');
 if(occupation?.trim()&&status!=='يعمل')throw new Error('اكتب نوع العمل مع اختيار يعمل فقط');
}
function validateOptionalNationalId(value:string|null|undefined):string {
 const normalized=normalizeEgyptianNationalIdInput(value??'');
 if(value?.trim()&&!parseEgyptianNationalId(normalized,cairoToday()))throw new Error('الرقم القومي لازم يكون ١٤ رقم وتاريخ الميلاد والمحافظة فيه صحيحين.');
 return normalized;
}
function profileValues(input:CaseFileInput){
 return {father_name:input.fatherName.trim()||null,mother_name:input.motherName.trim()||null,contact_name:input.contactName.trim()||null,
  contact_relationship:input.contactRelationship.trim()||null,contact_age:input.contactAge,national_id:input.nationalId.trim()||null,
  national_id_expires_on:input.nationalIdExpiresOn||null,phone:input.phones[0]?.trim()||null,phone_2:input.phones[1]?.trim()||null,phone_3:input.phones[2]?.trim()||null,
  notes:input.notes,address:input.address.trim()||null,monthly_income:input.monthlyIncome,health_condition:input.healthCondition.trim()||null,
  branch_area:input.branchArea.trim()||null,file_status:input.fileStatus,status_reason:input.fileStatus==='موقوف'||input.fileStatus==='مرفوض'?input.statusReason.trim():null,
  father_national_id:(input.fatherNationalId??'').trim()||null,mother_national_id:(input.motherNationalId??'').trim()||null,
  father_national_id_expires_on:input.fatherNationalIdExpiresOn||null,mother_national_id_expires_on:input.motherNationalIdExpiresOn||null,
  father_health_condition:(input.fatherHealthCondition??'').trim()||null,mother_health_condition:(input.motherHealthCondition??'').trim()||null,
  father_health_status:input.fatherHealthStatus||null,mother_health_status:input.motherHealthStatus||null,
  father_employment_status:input.fatherEmploymentStatus||null,mother_employment_status:input.motherEmploymentStatus||null,
  father_occupation:input.fatherEmploymentStatus==='يعمل'?(input.fatherOccupation??'').trim()||null:null,
  mother_occupation:input.motherEmploymentStatus==='يعمل'?(input.motherOccupation??'').trim()||null:null,
  father_date_of_birth:input.fatherDateOfBirth||null,father_gender:input.fatherName||input.fatherNationalId||input.fatherDateOfBirth?'male':null,
  mother_date_of_birth:input.motherDateOfBirth||null,mother_gender:input.motherName||input.motherNationalId||input.motherDateOfBirth?'female':null,
  contact_date_of_birth:input.contactDateOfBirth||null,contact_gender:input.contactGender||null,next_review_date:input.nextReviewDate||null};
}
export async function saveCaseFile(id:string|null,input:CaseFileInput):Promise<string>{
 const visibleInput=sanitizeCaseFileInput(input);
 validateInput(visibleInput,id===null);
 const {data,error}=await db().rpc('save_case_file',{p_id:id,p_profile:profileValues(visibleInput),p_categories:visibleInput.categories});check(error);
 if(typeof data!=='string')throw new Error('ماقدرناش نحفظ ملف الحالة. جرّب تاني.');return data;
}
export async function updateCaseFileIdentity(id:string,nationalId:string,expiresOn:string,profile?:{birthDate:string|null;gender:MemberGender|null;age:number|null}):Promise<void>{
 if(profile){
  const {error}=await db().rpc('update_case_file_identity_profile',{p_id:id,p_national_id:normalizeEgyptianNationalIdInput(nationalId)||null,p_expires_on:expiresOn||null,p_birth_date:profile.birthDate,p_gender:profile.gender,p_age:profile.age});check(error);return;
 }
 const {error}=await db().rpc('update_case_file_identity',{p_id:id,p_national_id:normalizeEgyptianNationalIdInput(nationalId)||null,p_expires_on:expiresOn||null});check(error);
}
export async function updateCaseParentIdentityProfile(id:string,parent:'father'|'mother',nationalId:string,expiresOn:string,profile:{birthDate:string|null;gender:MemberGender|null}):Promise<void>{
 const normalizedId=normalizeEgyptianNationalIdInput(nationalId);
 if(normalizedId&&!parseEgyptianNationalId(normalizedId,cairoToday()))throw new Error('اتأكد إن الرقم القومي ١٤ رقم وتاريخ الميلاد والمحافظة فيه صحيحين.');
 const {error}=await db().rpc('update_case_parent_identity_profile',{p_id:id,p_parent:parent,p_national_id:normalizedId||null,p_expires_on:expiresOn||null,p_birth_date:profile.birthDate,p_gender:parent==='father'?'male':'female'});check(error);
}
export const countCaseFiles=()=>countRows('families');
export async function listCaseFileIdExpirationsBy(cutoff:string):Promise<CaseFileIdExpiry[]> {
 return allPages<CaseFileIdExpiry>((start,end)=>db().rpc('list_case_file_id_expirations',{p_cutoff:cutoff}).order('id').order('national_id_expires_on').order('identity_holder').range(start,end));
}
export async function listCaseReviewDatesBy(cutoff:string):Promise<import('../features/cases/reviewReminder').CaseReviewRecord[]> {
 return allPages((start,end)=>db().from('families').select('id,code,father_name,mother_name,next_review_date').is('archived_at',null).not('next_review_date','is',null).lte('next_review_date',cutoff).order('next_review_date').order('id').range(start,end)) as Promise<import('../features/cases/reviewReminder').CaseReviewRecord[]>;
}
export async function listMembers(caseFileId: string): Promise<Member[]> {
 return allPages((start,end)=>db().from('family_members').select('person_id,relationship,father_status,people(name,gender,date_of_birth,national_id,health_condition,health_status,health_details,employment_status,occupation)').eq('family_id',caseFileId).order('person_id').range(start,end)) as unknown as Promise<Member[]>;
}
export async function listAllMembers(): Promise<CaseFileMember[]> {
 return allPages((start,end)=>db().from('family_members').select('family_id,person_id,relationship,father_status,people(name,gender,date_of_birth,national_id,health_condition,health_status,health_details),case_file:families!inner(archived_at)').is('case_file.archived_at',null).order('family_id').order('person_id').range(start,end)) as unknown as Promise<CaseFileMember[]>;
}
export async function listAgeThresholdMembers():Promise<MemberAgeProfile[]> {
 return allPages((start,end)=>db().from('family_members').select('family_id,person_id,relationship,people(name,gender,date_of_birth,health_condition,health_status,health_details),case_file:families!inner(code,father_name,mother_name,archived_at)').is('case_file.archived_at',null).order('family_id').order('person_id').range(start,end)) as unknown as Promise<MemberAgeProfile[]>;
}
export async function addMember(caseFileId: string, name: string, relationship: string, gender:MemberGender|null=null, dateOfBirth:string|null=null, healthStatus:HealthStatus|null=null, healthDetails:string|null=null, employmentStatus:EmploymentStatus|null=null, occupation:string|null=null,nationalId:string|null=null): Promise<void> {
 validateEmployment(employmentStatus,occupation);
 const normalizedId=validateOptionalNationalId(nationalId);
 const {error}=await db().rpc('add_family_member_profile',{p_family_id:caseFileId,p_name:name,p_relationship:relationship,p_gender:gender,p_date_of_birth:dateOfBirth,p_health_status:healthStatus,p_health_details:healthDetails,p_employment_status:employmentStatus,p_occupation:employmentStatus==='يعمل'?occupation:null,p_national_id:normalizedId||null}); check(error);
}
export async function updateMemberDemographics(personId:string,gender:MemberGender|null,dateOfBirth:string|null,healthStatus:HealthStatus|null=null,healthDetails:string|null=null,employmentStatus:EmploymentStatus|null=null,occupation:string|null=null,nationalId:string|null=null):Promise<void>{
 validateEmployment(employmentStatus,occupation);
 const normalizedId=validateOptionalNationalId(nationalId);
 const {data,error}=await db().from('people').update({gender,date_of_birth:dateOfBirth,health_status:healthStatus,health_details:healthDetails,health_condition:healthDetails,employment_status:employmentStatus,occupation:employmentStatus==='يعمل'?occupation:null,national_id:normalizedId||null}).eq('id',personId).select('id').single();
 check(error);if(!data)throw new Error('ماقدرناش نحفظ بيانات السن. جرّب تاني.');
}
export type CaseMemberProfileInput={name:string;relationship:string;gender:MemberGender|null;dateOfBirth:string|null;healthStatus:HealthStatus|null;healthDetails:string|null;employmentStatus:EmploymentStatus|null;occupation:string|null;nationalId:string|null;fatherStatus:'الأب موجود'|'يتيم الأب'|null};
export async function saveCaseMemberProfile(caseFileId:string,personId:string|null,input:CaseMemberProfileInput):Promise<void>{
 validateEmployment(input.employmentStatus,input.occupation);
 const normalizedId=validateOptionalNationalId(input.nationalId);
 const rpcArgs={p_family_id:caseFileId,p_name:input.name.trim(),p_relationship:input.relationship.trim(),p_gender:input.gender,p_date_of_birth:input.dateOfBirth,p_health_status:input.healthStatus,p_health_details:input.healthDetails,p_employment_status:input.employmentStatus,p_occupation:input.employmentStatus==='يعمل'?input.occupation:null,p_national_id:normalizedId||null,p_father_status:input.fatherStatus};
 const {error}=personId
  ? await db().rpc('update_case_member_profile',{...rpcArgs,p_person_id:personId})
  : await db().rpc('add_case_member_profile',rpcArgs);
 check(error);
}
export async function listCaseAttachments(caseFileId:string):Promise<CaseAttachment[]> {
 return allPages((start,end)=>db().from('case_attachments').select('*').eq('family_id',caseFileId).order('created_at').order('id').range(start,end));
}
export async function downloadCaseAttachment(file:CaseAttachment):Promise<File> {
 const {data,error}=await db().storage.from('case-files').download(file.storage_path);check(error);if(!data)throw new Error('ماقدرناش نحمّل الملف. جرّب تاني.');return new File([data],file.file_name,{type:file.mime_type});
}
async function uploadAttachment(caseFileId:string,file:File,documentType:CaseAttachmentDocumentType='general'):Promise<CaseAttachment>{
 validateDocument(file);if(file.type==='application/pdf'){const pdf=await openPdf(file);await pdf.cleanup();}
 const client=db();const {data:{session},error:authError}=await client.auth.getSession();check(authError);if(!session)throw new Error('يلزم تسجيل الدخول');
 const response=await fetch('/api/case-files/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type,'X-Case-File-Id':caseFileId,'X-File-Name':encodeURIComponent(file.name),'X-Document-Type':documentType},body:file});
 if(!response.ok)throw new Error('ماقدرناش نرفع الملف. جرّب تاني.');return await response.json() as CaseAttachment;
}
export async function uploadCaseAttachment(caseFileId:string,file:File,documentType:CaseAttachmentDocumentType='general'):Promise<CaseAttachment>{return uploadAttachment(caseFileId,file,documentType);}
export async function removeCaseAttachment(fileId:string):Promise<void>{
 const client=db();const {data:{session},error:authError}=await client.auth.getSession();check(authError);if(!session)throw new Error('يلزم تسجيل الدخول');
 const response=await fetch('/api/case-files/delete',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({fileId})});if(!response.ok)throw new Error('ماقدرناش نحذف الملف. اتأكد من صلاحيتك وجرب تاني.');
}
