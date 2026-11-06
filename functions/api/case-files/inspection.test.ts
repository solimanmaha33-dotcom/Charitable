import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {inspectUpload} from './inspection';
const fixture=(name:string)=>new Uint8Array(readFileSync(`tests/fixtures/${name}`));
it('accepts real synthetic PDF and rejects an over-page PDF',async()=>{
 await expect(inspectUpload(fixture('arabic-sample.pdf'),'application/pdf')).resolves.toBe('application/pdf');
 await expect(inspectUpload(fixture('over-20-pages.pdf'),'application/pdf')).rejects.toThrow();
});
it('rejects a claimed MIME type that disagrees with bytes',async()=>{
 await expect(inspectUpload(fixture('arabic-sample.png'),'application/pdf')).rejects.toThrow();
});
it('rejects a synthetic PNG with extreme declared dimensions',async()=>{
 const bytes=fixture('arabic-sample.png'); const view=new DataView(bytes.buffer);view.setUint32(16,100000);view.setUint32(20,100000);
 await expect(inspectUpload(bytes,'image/png')).rejects.toThrow();
});
