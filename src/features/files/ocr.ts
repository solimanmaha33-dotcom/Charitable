import { openPdf, pdfTextFromItems, validateDocument } from './documentText';
type Extracted = {pages: Array<{page:number;text:string;confidence:number}>; source:'pdf-text'|'ocr'};
export async function extractDocumentText(file: File): Promise<Extracted> {
 validateDocument(file);
 let worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | undefined;
 async function recognize(image: HTMLCanvasElement | File) {
  if (!worker) {
   const {createWorker}=await import('tesseract.js');
   const base = `${location.origin}${import.meta.env.BASE_URL}ocr/`;
   worker=await createWorker('ara', 1, {workerPath: `${base}worker.min.js`, corePath:`${base}tesseract-core-lstm.wasm.js`,langPath:base, cacheMethod:'none'});
  }
  const {data}=await worker.recognize(image);
  return {text:data.text,confidence:data.confidence};
 }
 try {
  if (file.type !== 'application/pdf') return {pages:[{page:1,...await recognize(file)}],source:'ocr'};
  const pdf=await openPdf(file); const pages:Extracted['pages']=[]; let usedOcr=false;
  try {
   for(let i=1;i<=pdf.numPages;i++) {
    const page=await pdf.getPage(i); const content=await page.getTextContent();
    const text=pdfTextFromItems(content.items.filter(item=>'str' in item));
    if (text) pages.push({page:i,text,confidence:100});
    else {
     usedOcr=true; const viewport=page.getViewport({scale:2});
     if (viewport.width * viewport.height > 20_000_000) throw new Error('أبعاد الصفحة كبيرة جداً');
     const canvas=document.createElement('canvas'); canvas.width=viewport.width; canvas.height=viewport.height;
     const context=canvas.getContext('2d'); if(!context) throw new Error('تعذّر عرض الصفحة');
     await page.render({canvas,canvasContext:context,viewport}).promise;
     pages.push({page:i,...await recognize(canvas)}); canvas.width=0; canvas.height=0;
    }
    page.cleanup();
   }
  } finally { await pdf.cleanup(); }
  return {pages,source:usedOcr ? 'ocr':'pdf-text'};
 } finally { if (worker) await worker.terminate(); }
}
