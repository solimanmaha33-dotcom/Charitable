import { getSupabase } from './supabase';
import type { EmployeePermission, StaffProfile, StaffRole } from '../features/auth/permissions';
export type StaffInput={employeeCode:string;displayName:string;password:string;role:StaffRole;permissions:EmployeePermission};
function client(){const value=getSupabase();if(!value)throw Error('No connection');return value;}
export async function listStaff():Promise<StaffProfile[]>{
 const db=client();const staff:StaffProfile[]=[];const size=500;
 for(let start=0;;start+=size){
  const {data,error}=await db.from('employees').select('id,employee_code,display_name,role,active,employee_permissions(cases_read,cases_write,donations_read,donations_write,assistant_use)').order('id').range(start,start+size-1);
  if(error)throw error;
  for(const item of data??[]){const p=Array.isArray(item.employee_permissions)?item.employee_permissions[0]:item.employee_permissions;staff.push({id:item.id,employeeCode:item.employee_code,displayName:item.display_name,role:item.role as StaffRole,active:item.active,permissions:{casesRead:p?.cases_read??false,casesWrite:p?.cases_write??false,donationsRead:p?.donations_read??false,donationsWrite:p?.donations_write??false,assistantUse:p?.assistant_use??false}});}
  if((data?.length??0)<size)return staff;
 }
}
async function mutate(method:'POST'|'PATCH',body:unknown){const {data,error}=await client().auth.getSession();if(error||!data.session)throw Error('Session required');const response=await fetch('/api/staff',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body)});if(response.status===409)throw new StaffPermissionsConflict();if(!response.ok)throw Error('Staff update failed');}
export async function createStaff(input:StaffInput){await mutate('POST',input);}
export class StaffPermissionsConflict extends Error {}
export async function updateStaffPermissions(employeeId:string,permissions:EmployeePermission,expectedPermissions:EmployeePermission){await mutate('PATCH',{employeeId,permissions,expectedPermissions});}
export async function deactivateStaff(employeeId:string){await mutate('PATCH',{employeeId,active:false});}
