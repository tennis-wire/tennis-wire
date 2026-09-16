// The report reasons discussion-service accepts (`discussion.reports.reasons` in its
// application.yaml); the wording is the client's
export const REPORT_REASONS = [
    'spam',
    'insult',
    'hate',
    'illegal',
    'personal_data',
    'other',
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]
