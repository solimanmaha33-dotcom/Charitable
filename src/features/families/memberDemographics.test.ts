import {expect,it} from 'vitest';
import {parseMemberIdText} from './memberDemographics';

it('derives date of birth and gender from an Egyptian national ID',()=>{
 expect(parseMemberIdText('٢٩٠٠١٠١١٢٣٤٥٦٧')).toEqual({nationalId:'29001011234567',birthDate:'1990-01-01',gender:'female'});
 expect(parseMemberIdText('29001011234577')).toEqual({nationalId:'29001011234577',birthDate:'1990-01-01',gender:'male'});
});

it('reads a date only when the document labels it as date of birth',()=>{
 expect(parseMemberIdText('تاريخ الميلاد: ٠١/٠٢/٢٠٠٠')).toEqual({nationalId:null,birthDate:'2000-02-01',gender:null});
 expect(parseMemberIdText('٠١/٠٢/٢٠٠٠')).toEqual({nationalId:null,birthDate:null,gender:null});
});

it('rejects wrong-length IDs, unsupported centuries, and impossible birth dates',()=>{
 for(const value of ['12345','19001011234567','29913211234567']) expect(parseMemberIdText(value)).toEqual({nationalId:null,birthDate:null,gender:null});
});
