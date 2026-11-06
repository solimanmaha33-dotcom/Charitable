export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 20;
export function validateDocument(file: File): void {
 if (!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('نوع الملف غير مدعوم');
 if (file.size > MAX_BYTES || file.size === 0) throw new Error('حجم الملف يجب أن يكون أقل من أو يساوي ٢٠ ميجابايت');
}
export async function openPdf(file: File) {
 const pdfjs = await import('pdfjs-dist');
 const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
 pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
 const pdf = await pdfjs.getDocument({data: await file.arrayBuffer()}).promise;
 if (pdf.numPages > MAX_PAGES) { await pdf.cleanup(); throw new Error('الحد الأقصى ٢٠ صفحة'); }
 return pdf;
}
// Some PDF generators emit Arabic as individual positioned presentation glyphs in visual order.
export function pdfTextFromItems(items: Array<{str:string;dir:string;hasEOL:boolean}>):string {
 const lines: typeof items[]=[[]];
 for(const item of items) {if(item.str) lines[lines.length-1].push(item); if(item.hasEOL) lines.push([]);}
 return lines.map(line=>{
  const glyphs=line.filter(x=>x.dir==='rtl' && x.str.trim());
  const fragmented=glyphs.length>1 && glyphs.every(x=>Array.from(x.str).length===1);
  return (fragmented ? [...line].reverse() : line).map(x=>x.str).join('').normalize('NFKC');
 }).join('\n').trim();
}
