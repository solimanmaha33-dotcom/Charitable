export const HEALTH_STATUSES = ['عجز / إعاقة', 'مرض', 'حالة مستقرة'] as const;
export type HealthStatus = typeof HEALTH_STATUSES[number];
