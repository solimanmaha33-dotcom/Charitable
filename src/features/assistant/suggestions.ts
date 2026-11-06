import {CASE_CATEGORIES, type CaseCategory} from '../cases/categories';
export type Suggestion = { field:string; value:string; evidence:string };
export function parseSuggestions(value: unknown, fields: string[], text: string): Suggestion[] {
 if (!value || typeof value !== 'object' || !('suggestions' in value) || !Array.isArray(value.suggestions) || value.suggestions.length > 20) throw new Error('Invalid suggestions');
 return value.suggestions.map((item: unknown) => {
  if (!item || typeof item !== 'object') throw new Error('Invalid suggestion');
  const s=item as Record<string,unknown>;
  if (typeof s.field !== 'string' || !fields.includes(s.field) || !['notes','case_categories'].includes(s.field) || typeof s.value !== 'string' || !s.value.trim() || s.value.length>2000 || typeof s.evidence !== 'string' || !s.evidence.trim() || !text.includes(s.evidence)) throw new Error('Invalid suggestion');
  if(s.field==='case_categories' && !CASE_CATEGORIES.includes(s.value as CaseCategory)) throw new Error('Invalid category');
  return {field:s.field,value:s.value,evidence:s.evidence};
 });
}
