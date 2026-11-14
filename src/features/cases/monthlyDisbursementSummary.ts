import type {CaseDisbursement} from '../../services/disbursements';

export function monthlyDisbursementSummary(records:readonly Pick<CaseDisbursement,'amount'|'disbursed_on'|'is_voided'>[],today:string):{count:number;total:number}{
 const month=today.slice(0,7);const current=records.filter(record=>!record.is_voided&&record.disbursed_on.slice(0,7)===month);
 const total=current.reduce((sum,record)=>sum+(Number.isFinite(record.amount)?record.amount:0),0);
 return{count:current.length,total:Math.round((total+Number.EPSILON)*100)/100};
}
