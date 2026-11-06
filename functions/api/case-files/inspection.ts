import { PDFDocument } from 'pdf-lib';
import { imageSize } from 'image-size';
export const MAX_BYTES=20*1024*1024;
export async function inspectUpload(bytes:Uint8Array,claimed:string):Promise<string> {
 if(!bytes.length || bytes.length>MAX_BYTES) throw new Error('Invalid size');
 const magic=String.fromCharCode(...bytes.slice(0,5));
 if(claimed==='application/pdf') {
  if(magic!=='%PDF-') throw new Error('Invalid PDF');
  const pdf=await PDFDocument.load(bytes,{throwOnInvalidObject:true});
  if(pdf.getPageCount()<1 || pdf.getPageCount()>20) throw new Error('Invalid page count');
  return claimed;
 }
 const dimensions=imageSize(bytes);
 const allowed:Record<string,string>={png:'image/png',jpg:'image/jpeg',webp:'image/webp'};
 if(allowed[dimensions.type ?? '']!==claimed || !dimensions.width || !dimensions.height || dimensions.width*dimensions.height>20_000_000) throw new Error('Invalid image');
 return claimed;
}
