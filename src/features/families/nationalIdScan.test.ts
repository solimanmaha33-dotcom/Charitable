import {expect,it} from 'vitest';
import {parseNationalIdScan} from './nationalIdScan';

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
