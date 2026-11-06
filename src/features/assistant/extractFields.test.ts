import { expect, it } from 'vitest';
import { parseSuggestions } from './suggestions';
it('rejects unsupported fields and evidence not found in the reviewed text',()=>{
 expect(()=>parseSuggestions({suggestions:[{field:'family_id',value:'x',evidence:'x'}]},['notes'],'x')).toThrow();
 expect(()=>parseSuggestions({suggestions:[{field:'notes',value:'x',evidence:'غير موجود'}]},['notes'],'نص')).toThrow();
});
