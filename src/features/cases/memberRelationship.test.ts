import { expect, it } from 'vitest';
import { isChildRelationship } from './memberRelationship';

it.each(['ابن','الابن','ابني','ابنى','ابنة','الابنة','بنت','البنت','ولد','الولد','طفل','الطفل','طفلة','الطفلة'])('recognizes the child relationship %s',value=>expect(isChildRelationship(value)).toBe(true));
it.each(['أب','أم','زوج','زوجة','أخ','أخت','خالة','مسؤول'])('does not treat %s as a child relationship',value=>expect(isChildRelationship(value)).toBe(false));
