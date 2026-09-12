// The moderation queue as discussion-service sends it.

export interface RemovalCounts {
    last30Days: number
    total: number
}

// Present only while a ban is in force. A null expiry means indefinite
export interface ActiveRestriction {
    expiresAt: string | null
}

export interface QueueAuthor {
    id: string
    // Absent when user-service could not be reached; the card is still usable
    displayName: string | null
    avatarUrl: string | null
    restriction: ActiveRestriction | null
    removedByModerator: RemovalCounts
    removedByBot: RemovalCounts
}

export interface QueueEntry {
    commentId: string
    subjectType: string
    subjectId: string
    rootId: string
    body: string
    // The author took it down himself: it can be counted against him, but not removed again
    deletedByAuthor: boolean
    author: QueueAuthor
    reportCount: number
    // Reason code to how many reports named it
    reasons: Record<string, number>
    fromBot: boolean
    firstReportedAt: string
    lastReportedAt: string
}

export interface ModerationQueue {
    items: QueueEntry[]
    page: number
    size: number
}

// What a moderator can write. 'counted' only applies to a comment its author deleted
export type Resolution = 'hidden' | 'dismissed' | 'counted'

export const REASON_LABELS: Record<string, string> = {
    spam: 'Спам',
    insult: 'Оскорбления',
    hate: 'Разжигание ненависти',
    illegal: 'Противоправное',
    personal_data: 'Личные данные',
    other: 'Другое',
}
