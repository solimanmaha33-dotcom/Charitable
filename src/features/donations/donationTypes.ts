export const donationTypes = [
 ['cash','نقدي'], ['in_kind_food','مواد غذائية عينية'], ['clothing','ملابس'], ['medicine','أدوية'],
 ['zakat','زكاة'], ['sadaqa','صدقة'], ['zakat_al_fitr','زكاة الفطر'], ['ramadan_food_bags','شنط رمضان'],
 ['eid_clothing','كسوة العيد'], ['sacrificial_meat','لحوم الأضاحي'], ['blankets','بطاطين'],
 ['school_supplies','مستلزمات دراسية'], ['treatment_support','مساعدة علاج'],
] as const;
export function donationTypeLabel(type:string) { return donationTypes.find(([key])=>key===type)?.[1]??type; }
