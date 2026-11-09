import {expect,it} from 'vitest';
import {parseEgyptianNationalId,parseNationalIdScan} from './nationalIdScan';

it('reads Arabic ID digits and an expiry date labeled in Arabic',()=>{
 expect(parseNationalIdScan('الرقم القومي: ٢٩٠٠١٠١١٢٣٤٥٦٧\nتاريخ الانتهاء: ٠١/٠٢/٢٠٢٧')).toEqual({nationalId:'29001011234567',expiresOn:'2027-02-01'});
});

it('reads English labels, Persian digits, and year-first expiry dates',()=>{
 expect(parseNationalIdScan('ID ۲۹۰۰۱۰۱۱۲۳۴۵۶۷ Expiry: 2027-12-31')).toEqual({nationalId:'29001011234567',expiresOn:'2027-12-31'});
});

it('does not mistake an unlabelled birth date for expiry and rejects impossible dates',()=>{
 expect(parseNationalIdScan('الرقم القومي 29001011234567 تاريخ الميلاد 01/02/1990')).toEqual({nationalId:'29001011234567',expiresOn:null});
 expect(parseNationalIdScan('الرقم القومي 29001011234567 تاريخ الانتهاء تاريخ الميلاد 01/02/1990')).toEqual({nationalId:'29001011234567',expiresOn:null});
 expect(parseNationalIdScan('الرقم القومي 29001011234567 تاريخ الانتهاء 31/02/2027').expiresOn).toBeNull();
});

it('decodes a valid 1900s ID with Cairo age and governorate',()=>{
 expect(parseEgyptianNationalId('29912240112345','2026-11-09')).toEqual({nationalId:'29912240112345',birthDate:'1999-12-24',age:26,governorateCode:'01',governorate:'القاهرة',gender:'female'});
});

it('decodes a 2000s leap-day ID and maps the odd gender digit to male',()=>{
 expect(parseEgyptianNationalId('32402291234577','2026-02-28')).toEqual({nationalId:'32402291234577',birthDate:'2024-02-29',age:1,governorateCode:'12',governorate:'الدقهلية',gender:'male'});
});

it('normalizes Arabic and Persian digits and maps an even gender digit to female',()=>{
 expect(parseEgyptianNationalId('٣٢٤٠٢٢٩١٢٣٤٥٦٧','2026-03-01')).toEqual({nationalId:'32402291234567',birthDate:'2024-02-29',age:2,governorateCode:'12',governorate:'الدقهلية',gender:'female'});
 expect(parseEgyptianNationalId('۲۹۰۰۱۰۱۱۲۳۴۵۶۷','2026-11-09')?.gender).toBe('female');
});

it.each(['12345678901234','19001011234567','29913240112345','29902290112345','29912249912345','32612011234567'])('rejects an invalid Egyptian ID structure or date: %s',id=>{
 expect(parseEgyptianNationalId(id,'2026-11-30')).toBeNull();
});

it('uses the century 2 leap-year rule and rejects unrecognized governorates',()=>{
 expect(parseEgyptianNationalId('20002291234567','2026-11-09')).toBeNull();
 expect(parseEgyptianNationalId('29912249912345','2026-11-09')).toBeNull();
});
