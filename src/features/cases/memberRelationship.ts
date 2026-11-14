const CHILD_RELATIONSHIPS=new Set(['ابن','الابن','ابني','ابنى','ابنة','الابنة','بنت','البنت','ولد','الولد','طفل','الطفل','طفلة','الطفلة']);
export function isChildRelationship(value:string):boolean{return CHILD_RELATIONSHIPS.has(value.trim().toLocaleLowerCase('ar-EG'));}
