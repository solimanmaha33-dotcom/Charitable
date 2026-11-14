import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseAttachmentsPanel } from './CaseAttachmentsPanel';

const state = vi.hoisted(() => ({ files: [] as Array<Record<string, unknown>>, upload: vi.fn() }));
vi.mock('../../services/cases', () => ({
  downloadCaseAttachment: vi.fn(),
  listCaseAttachments: vi.fn(async () => state.files),
  removeCaseAttachment: vi.fn(),
  uploadCaseAttachment: state.upload,
}));
vi.mock('../files/FilePicker', () => ({ FilePicker: ({ files, onChange, legend, label }: {files:File[];onChange:(files:File[])=>void;legend:string;label:string}) => <fieldset><legend>{legend}</legend><label>{label}<input type="file" multiple onChange={event=>{const added=Array.from(event.currentTarget.files??[]);if(added.length)onChange([...files,...added]);}} /></label>{files.map(file=><span key={file.name}>{file.name}</span>)}</fieldset> }));
vi.mock('../files/FilePreview', () => ({ FilePreview: () => null }));
vi.mock('./CaseIdScanner', () => ({ CaseIdScanner: () => null }));

const caseFile = {id:'case-1',code:'F-0001',case_file_categories:[]} as never;
beforeEach(()=>{state.files=[];state.upload.mockReset().mockImplementation(async (_id:string,file:File,type='general')=>{state.files.push({id:file.name,file_name:file.name,document_type:type,size_bytes:20});return state.files.at(-1);});});

it('shows a gentle reminder when social research is missing and turns it off after upload',async()=>{
 render(<CaseAttachmentsPanel caseFile={caseFile} canWrite onCaseFileUpdated={vi.fn()}/>);
 expect(await screen.findByText(/البحث الاجتماعي مش مرفوع/)).toBeVisible();
 const file=new File(['صورة'], 'بحث اجتماعي.png',{type:'image/png'});
 fireEvent.change(screen.getByLabelText('اختار البحث الاجتماعي (صورة أو PDF)'),{target:{files:[file]}});
 fireEvent.click(screen.getByRole('button',{name:'رفع البحث الاجتماعي'}));
 await waitFor(()=>expect(state.upload).toHaveBeenCalledWith('case-1',file,'social_research'));
 expect(await screen.findByText(/البحث الاجتماعي مرفوع/)).toBeVisible();
 expect(screen.queryByText(/البحث الاجتماعي مش مرفوع/)).not.toBeInTheDocument();
});

it('uploads every selected page of the social-research file',async()=>{
 render(<CaseAttachmentsPanel caseFile={caseFile} canWrite onCaseFileUpdated={vi.fn()}/>);
 const pageOne=new File(['صفحة أولى'], 'بحث-١.png',{type:'image/png'});
 const pageTwo=new File(['صفحة تانية'], 'بحث-٢.png',{type:'image/png'});
 fireEvent.change(screen.getByLabelText('اختار البحث الاجتماعي (صورة أو PDF)'),{target:{files:[pageOne,pageTwo]}});
 fireEvent.click(screen.getByRole('button',{name:'رفع البحث الاجتماعي'}));
 await waitFor(()=>expect(state.upload).toHaveBeenCalledTimes(2));
 expect(state.upload).toHaveBeenNthCalledWith(1,'case-1',pageOne,'social_research');
 expect(state.upload).toHaveBeenNthCalledWith(2,'case-1',pageTwo,'social_research');
 expect(state.files.map(file=>file.file_name)).toEqual(['بحث-١.png','بحث-٢.png']);
});

it('updates the case details after uploading a regular attachment',async()=>{
 const onCaseFileUpdated=vi.fn();
 render(<CaseAttachmentsPanel caseFile={caseFile} canWrite onCaseFileUpdated={onCaseFileUpdated}/>);
 const file=new File(['صورة'], 'مرفق.png',{type:'image/png'});
 fireEvent.change(screen.getByLabelText('إضافة صور أو PDF للحالة'),{target:{files:[file]}});
 fireEvent.click(screen.getByRole('button',{name:'رفع المرفقات'}));
 await waitFor(()=>expect(onCaseFileUpdated).toHaveBeenCalledOnce());
});

it('updates the case details after deleting an attachment',async()=>{
 const onCaseFileUpdated=vi.fn();
 state.files=[{id:'one',file_name:'مرفق.png',document_type:'general',size_bytes:100}];
 render(<CaseAttachmentsPanel caseFile={caseFile} canWrite onCaseFileUpdated={onCaseFileUpdated}/>);
 fireEvent.click(await screen.findByRole('button',{name:'حذف مرفق.png'}));
 fireEvent.click(screen.getByRole('button',{name:'تأكيد الحذف'}));
 await waitFor(()=>expect(onCaseFileUpdated).toHaveBeenCalledOnce());
});

it('labels the social-research document separately from regular attachments',async()=>{
 state.files=[{id:'one',file_name:'بحث.pdf',document_type:'social_research',size_bytes:100},{id:'two',file_name:'صورة.png',document_type:'general',size_bytes:100}];
 render(<CaseAttachmentsPanel caseFile={caseFile} canWrite={false} onCaseFileUpdated={vi.fn()}/>);
 expect(await screen.findByText(/البحث الاجتماعي مرفوع/)).toBeVisible();
 expect(screen.getByText('بحث.pdf').parentElement).toHaveTextContent('البحث الاجتماعي');
 expect(screen.getByText('صورة.png').parentElement).toHaveTextContent('مرفق عادي');
});
