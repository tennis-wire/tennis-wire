import type { Comment, ReactionSlot } from './types'

// Mirrors discussion.reaction.emoji in the service, in the order the row is drawn. A key the service
// stops sending keeps its place here harmlessly; a key it starts sending needs a line here to show.
export const EMOJI = [
    { key: 'laugh', glyph: '😂', label: 'Смешно' },
    { key: 'clown', glyph: '🤡', label: 'Клоунада' },
    { key: 'vomit', glyph: '🤮', label: 'Мерзость' },
] as const

export function heldBy(comment: Comment, slot: ReactionSlot): string | null {
    return (slot === 'vote' ? comment.viewerVote : comment.viewerEmoji) ?? null
}

/**
 * The comment as it looks once this reader's slot goes from one value to another. Counts move by
 * one in each direction, which is what a single reader can do; everyone else's are left alone.
 */
export function shifted(comment: Comment, slot: ReactionSlot, to: string | null): Comment {
    const from = heldBy(comment, slot)
    if (from === to) return comment
    if (slot === 'vote') {
        return {
            ...comment,
            likeCount: comment.likeCount + step(from, to, 'like'),
            dislikeCount: comment.dislikeCount + step(from, to, 'dislike'),
            viewerVote: to === 'like' || to === 'dislike' ? to : undefined,
        }
    }
    const counts = { ...comment.emojiCounts }
    if (from) {
        const left = (counts[from] ?? 0) - 1
        if (left > 0) counts[from] = left
        else delete counts[from]
    }
    if (to) counts[to] = (counts[to] ?? 0) + 1
    return { ...comment, emojiCounts: counts, viewerEmoji: to ?? undefined }
}

function step(from: string | null, to: string | null, value: string): number {
    return (to === value ? 1 : 0) - (from === value ? 1 : 0)
}
