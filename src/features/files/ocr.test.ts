import { describe, expect, it, vi } from 'vitest';
import { validateDocument } from './documentText';
import { copyExtractedText } from './useClipboard';

describe('case documents', () => {
 it('rejects unsupported formats and files above 20 MiB', () => {
  expect(() => validateDocument(new File(['x'], 'x.txt', {type:'text/plain'}))).toThrow();
  expect(() => validateDocument(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'x.png', {type:'image/png'}))).toThrow();
  expect(() => validateDocument(new File(['x'], 'x.pdf', {type:'application/pdf'}))).not.toThrow();
 });
 it('copies reviewed text on request', async () => {
  const writeText=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {value:{writeText}, configurable:true});
  await copyExtractedText('نص تجريبي');
  expect(writeText).toHaveBeenCalledWith('نص تجريبي');
 });
});

it('reassembles fragmented Arabic glyphs from PDF text in reading order', async () => {
 const {pdfTextFromItems}=await import('./documentText');
 expect(pdfTextFromItems([{str:'ﺔ',dir:'rtl',hasEOL:false},{str:'ﻴ',dir:'rtl',hasEOL:false},{str:'ﺑ',dir:'rtl',hasEOL:false},{str:'ﺮ',dir:'rtl',hasEOL:false},{str:'ﺠ',dir:'rtl',hasEOL:false},{str:'ﺗ',dir:'rtl',hasEOL:false}])).toBe('تجربية');
});
