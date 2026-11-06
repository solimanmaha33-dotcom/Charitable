import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { StaffPage } from './StaffPage';
import * as service from '../../services/staff';
vi.mock('../../services/staff');
const permissions={casesRead:false,casesWrite:false,donationsRead:false,donationsWrite:false,assistantUse:false};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(service.listStaff).mockResolvedValue([{id:'e1',employeeCode:'E1',displayName:'موظف تجريبي',role:'employee',active:true,permissions},{id:'m1',employeeCode:'M1',displayName:'مدير تجريبي',role:'manager',active:true,permissions}]);});
it('manager creates employees and can edit employee permissions only',async()=>{
 vi.mocked(service.createStaff).mockResolvedValue();vi.mocked(service.updateStaffPermissions).mockResolvedValue();
 render(<StaffPage role="manager"/>);await screen.findByText('موظف تجريبي');
 expect(screen.queryByRole('option',{name:'مدير'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'تعطيل الوصول'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('كود الموظف'),{target:{value:'E2'}});fireEvent.change(screen.getByLabelText('اسم الموظف'),{target:{value:'اسم وهمي'}});fireEvent.change(screen.getByLabelText('كلمة السر المؤقتة'),{target:{value:'synthetic-password'}});fireEvent.click(screen.getByRole('button',{name:'إنشاء الموظف'}));
 await waitFor(()=>expect(service.createStaff).toHaveBeenCalledWith(expect.objectContaining({employeeCode:'E2',role:'employee'})));
 const row=screen.getByRole('group',{name:'موظف تجريبي'});fireEvent.click(within(row).getByLabelText('قراءة الحالات'));fireEvent.click(within(row).getByRole('button',{name:'حفظ الصلاحيات'}));
 await waitFor(()=>expect(service.updateStaffPermissions).toHaveBeenCalledWith('e1',expect.objectContaining({casesRead:true}),expect.objectContaining({casesRead:false})));
 expect(within(screen.getByRole('group',{name:'مدير تجريبي'})).queryByRole('button',{name:'حفظ الصلاحيات'})).not.toBeInTheDocument();
});
it('general manager can create managerial roles and deactivate staff',async()=>{
 vi.mocked(service.deactivateStaff).mockResolvedValue();render(<StaffPage role="general_manager"/>);await screen.findByText('موظف تجريبي');expect(screen.getByRole('option',{name:'مدير'})).toBeInTheDocument();
 fireEvent.click(within(screen.getByRole('group',{name:'موظف تجريبي'})).getByRole('button',{name:'تعطيل الوصول'}));await waitFor(()=>expect(service.deactivateStaff).toHaveBeenCalledWith('e1'));
});
it('refresh replaces a revoked permission before editing another flag',async()=>{
 const old={...permissions,casesRead:true};const row=(p:typeof permissions)=>({id:'e1',employeeCode:'E1',displayName:'موظف تجريبي',role:'employee' as const,active:true,permissions:p});
 vi.mocked(service.listStaff).mockResolvedValueOnce([row(old)]).mockResolvedValue([row({...permissions})]);
 vi.mocked(service.createStaff).mockResolvedValue();vi.mocked(service.updateStaffPermissions).mockResolvedValue();
 render(<StaffPage role="manager"/>);const group=await screen.findByRole('group',{name:'موظف تجريبي'});expect(within(group).getByLabelText('قراءة الحالات')).toBeChecked();
 fireEvent.change(screen.getByLabelText('كود الموظف'),{target:{value:'E2'}});fireEvent.change(screen.getByLabelText('اسم الموظف'),{target:{value:'وهمي'}});fireEvent.change(screen.getByLabelText('كلمة السر المؤقتة'),{target:{value:'synthetic-password'}});fireEvent.click(screen.getByRole('button',{name:'إنشاء الموظف'}));
 await waitFor(()=>expect(within(group).getByLabelText('قراءة الحالات')).not.toBeChecked());
 fireEvent.click(within(group).getByLabelText('قراءة التبرعات'));fireEvent.click(within(group).getByRole('button',{name:'حفظ الصلاحيات'}));
 await waitFor(()=>expect(service.updateStaffPermissions).toHaveBeenCalledWith('e1',expect.objectContaining({casesRead:false,donationsRead:true}),expect.objectContaining({casesRead:false,donationsRead:false})));
});
it('preserves a draft on an unchanged refresh and rejects a conflicting save',async()=>{
 const row={id:'e1',employeeCode:'E1',displayName:'موظف تجريبي',role:'employee' as const,active:true,permissions:{...permissions}};
 vi.mocked(service.listStaff).mockResolvedValue([row]);vi.mocked(service.createStaff).mockResolvedValue();vi.mocked(service.updateStaffPermissions).mockRejectedValue(new Error('conflict'));
 render(<StaffPage role="manager"/>);const group=await screen.findByRole('group',{name:'موظف تجريبي'});fireEvent.click(within(group).getByLabelText('قراءة التبرعات'));
 fireEvent.change(screen.getByLabelText('كود الموظف'),{target:{value:'E2'}});fireEvent.change(screen.getByLabelText('اسم الموظف'),{target:{value:'وهمي'}});fireEvent.change(screen.getByLabelText('كلمة السر المؤقتة'),{target:{value:'synthetic-password'}});fireEvent.click(screen.getByRole('button',{name:'إنشاء الموظف'}));
 await waitFor(()=>expect(service.listStaff).toHaveBeenCalledTimes(2));expect(within(group).getByLabelText('قراءة التبرعات')).toBeChecked();
 fireEvent.click(within(group).getByRole('button',{name:'حفظ الصلاحيات'}));await screen.findByRole('alert');expect(service.updateStaffPermissions).toHaveBeenCalledWith('e1',expect.objectContaining({donationsRead:true}),expect.objectContaining({donationsRead:false}));
});
it('on a conflict reloads current permissions and asks the manager to review',async()=>{
 const row={id:'e1',employeeCode:'E1',displayName:'موظف تجريبي',role:'employee' as const,active:true,permissions:{...permissions,casesRead:true}};
 vi.mocked(service.listStaff).mockResolvedValueOnce([row]).mockResolvedValue([{...row,permissions:{...permissions}}]);
 vi.mocked(service.updateStaffPermissions).mockRejectedValue(new service.StaffPermissionsConflict());
 render(<StaffPage role="manager"/>);const group=await screen.findByRole('group',{name:'موظف تجريبي'});fireEvent.click(within(group).getByLabelText('قراءة التبرعات'));fireEvent.click(within(group).getByRole('button',{name:'حفظ الصلاحيات'}));
 await waitFor(()=>expect(within(group).getByLabelText('قراءة الحالات')).not.toBeChecked());expect(within(group).getByLabelText('قراءة التبرعات')).not.toBeChecked();expect(within(group).getByRole('alert')).toHaveTextContent('تغيّرت الصلاحيات بواسطة شخص آخر');
});

it('disables permission edits until the save and refresh complete',async()=>{
 const row={id:'e1',employeeCode:'E1',displayName:'موظف تجريبي',role:'employee' as const,active:true,permissions:{...permissions}};
 let finishSave!:()=>void;let finishRefresh!:(rows:typeof row[])=>void;
 vi.mocked(service.listStaff).mockResolvedValueOnce([row]).mockImplementationOnce(()=>new Promise(resolve=>{finishRefresh=resolve;}));
 vi.mocked(service.updateStaffPermissions).mockImplementationOnce(()=>new Promise(resolve=>{finishSave=resolve;}));
 render(<StaffPage role="manager"/>);const group=await screen.findByRole('group',{name:'موظف تجريبي'});
 const cases=within(group).getByLabelText('قراءة الحالات'), donations=within(group).getByLabelText('قراءة التبرعات');
 fireEvent.click(cases);fireEvent.click(within(group).getByRole('button',{name:'حفظ الصلاحيات'}));
 expect(cases).toBeDisabled();expect(donations).toBeDisabled();
 await act(async()=>finishSave());await waitFor(()=>expect(service.listStaff).toHaveBeenCalledTimes(2));expect(donations).toBeDisabled();
 await act(async()=>finishRefresh([{...row,permissions:{...permissions,casesRead:true,donationsRead:true}}]));
 await waitFor(()=>expect(donations).toBeEnabled());expect(cases).toBeChecked();expect(donations).toBeChecked();
});
