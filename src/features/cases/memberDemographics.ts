export type MemberGender='female'|'male';
export type MemberIdSuggestions={nationalId:string|null;birthDate:string|null;gender:MemberGender|null};

const arabic='٠١٢٣٤٥٦٧٨٩';const persian='۰۱۲۳۴۵۶۷۸۹';
function latinDigits(text:string):string{return [...text].map(char=>{const a=arabic.indexOf(char);if(a>=0)return String(a);const p=persian.indexOf(char);return p>=0?String(p):char;}).join('');}
function validDate(year:number,month:number,day:number):string|null{
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;
}
function labeledBirthDate(text:string):string|null{
 const label=/(?:تاريخ\s*(?:الميلاد|الولادة)|date\s*of\s*birth|birth\s*date|\bDOB\b)/giu;
 for(const match of text.matchAll(label)){
  const tail=text.slice((match.index??0)+match[0].length,(match.index??0)+match[0].length+80).split(/\n|تاريخ\s*(?:الانتهاء|انتهاء)|expiry|expires/iu)[0];
  const date=tail.match(/(?:^|\D)(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})(?!\d)|(?:^|\D)(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?!\d)/u);
  if(date){const parsed=date[3]?validDate(Number(date[3]),Number(date[2]),Number(date[1])):validDate(Number(date[4]),Number(date[5]),Number(date[6]));if(parsed)return parsed;}
 }
 return null;
}

export function parseMemberIdText(rawText:string):MemberIdSuggestions{
 const text=latinDigits(rawText);
 const found=text.match(/(?:^|\D)(\d(?:[\s-]*\d){13})(?!\d)/u)?.[1].replace(/[\s-]/gu,'');
 if(found&&(found[0]==='2'||found[0]==='3')){
  const year=Number(found.slice(1,3))+(found[0]==='2'?1900:2000);
  const birthDate=validDate(year,Number(found.slice(3,5)),Number(found.slice(5,7)));
  const sexDigit=Number(found[12]);
  if(birthDate&&Number.isInteger(sexDigit))return {nationalId:found,birthDate,gender:sexDigit%2===0?'female':'male'};
 }
 return {nationalId:null,birthDate:labeledBirthDate(text),gender:null};
}
