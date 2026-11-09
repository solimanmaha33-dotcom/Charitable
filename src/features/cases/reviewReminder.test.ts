import { describe, expect, it } from 'vitest';
import { groupCaseReviewReminders } from './reviewReminder';

describe('case review reminders', () => {
  it('separates overdue, due today, and upcoming files through the 30-day cutoff', () => {
    expect(groupCaseReviewReminders([
      { id:'late', code:'F-1', father_name:'أحمد', mother_name:'منى', next_review_date:'2026-10-31' },
      { id:'today', code:'F-2', father_name:'حسن', mother_name:null, next_review_date:'2026-11-01' },
      { id:'soon', code:'F-3', father_name:null, mother_name:'سعاد', next_review_date:'2026-11-30' },
      { id:'later', code:'F-4', father_name:null, mother_name:null, next_review_date:'2026-12-01' },
    ], '2026-11-01')).toEqual({
      overdue:[expect.objectContaining({ id:'late', daysOverdue:1 })],
      upcoming:[expect.objectContaining({ id:'today', daysLeft:0 }), expect.objectContaining({ id:'soon', daysLeft:29 }),expect.objectContaining({id:'later',daysLeft:30})],
    });
  });

  it('rejects impossible date values instead of grouping them', () => {
    expect(() => groupCaseReviewReminders([{ id:'bad', code:'F-1', father_name:null, mother_name:null, next_review_date:'2026-02-30' }], '2026-03-01')).toThrow();
  });
});
