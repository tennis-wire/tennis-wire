import { describe, expect, it } from 'vitest'

import { heldBy, shifted } from './reactions'
import type { Comment } from './types'

function comment(over: Partial<Comment> = {}): Comment {
    return {
        id: 'c1',
        subjectType: 'publication',
        subjectId: 's1',
        inReplyToId: null,
        rootId: 'c1',
        body: 'text',
        visibility: 'visible',
        replyCount: 0,
        repliesTruncated: false,
        createdAt: '2026-09-15T10:00:00Z',
        updatedAt: '2026-09-15T10:00:00Z',
        edited: false,
        likeCount: 0,
        dislikeCount: 0,
        emojiCounts: {},
        replies: [],
        ...over,
    }
}

describe('shifted', () => {
    it('adds the reader to a count he was not in', () => {
        const after = shifted(comment({ likeCount: 3 }), 'vote', 'like')

        expect(after.likeCount).toBe(4)
        expect(after.viewerVote).toBe('like')
    })

    it('moves him across in one step, taking one count down and the other up', () => {
        const before = comment({ likeCount: 4, dislikeCount: 1, viewerVote: 'like' })

        const after = shifted(before, 'vote', 'dislike')

        expect(after.likeCount).toBe(3)
        expect(after.dislikeCount).toBe(2)
        expect(after.viewerVote).toBe('dislike')
    })

    it('takes him out again', () => {
        const before = comment({ likeCount: 4, viewerVote: 'like' })

        const after = shifted(before, 'vote', null)

        expect(after.likeCount).toBe(3)
        expect(after.viewerVote).toBeUndefined()
    })

    it('leaves the comment alone when nothing changes', () => {
        const before = comment({ likeCount: 4, viewerVote: 'like' })

        expect(shifted(before, 'vote', 'like')).toBe(before)
    })

    it('drops an emoji key with the last of its count', () => {
        const before = comment({ emojiCounts: { clown: 1, laugh: 2 }, viewerEmoji: 'clown' })

        const after = shifted(before, 'emoji', null)

        expect(after.emojiCounts).toEqual({ laugh: 2 })
        expect(after.viewerEmoji).toBeUndefined()
    })

    it('keeps an emoji key others are still holding', () => {
        const before = comment({ emojiCounts: { clown: 3 }, viewerEmoji: 'clown' })

        expect(shifted(before, 'emoji', null).emojiCounts).toEqual({ clown: 2 })
    })

    it('does not touch the vote when the emoji moves', () => {
        const before = comment({ likeCount: 2, viewerVote: 'like' })

        const after = shifted(before, 'emoji', 'vomit')

        expect(after.likeCount).toBe(2)
        expect(after.viewerVote).toBe('like')
        expect(after.emojiCounts).toEqual({ vomit: 1 })
    })

    it('is its own inverse, which is what a refused request relies on', () => {
        const before = comment({ likeCount: 4, dislikeCount: 1, viewerVote: 'like' })

        const there = shifted(before, 'vote', 'dislike')
        const back = shifted(there, 'vote', heldBy(before, 'vote'))

        expect(back.likeCount).toBe(before.likeCount)
        expect(back.dislikeCount).toBe(before.dislikeCount)
        expect(back.viewerVote).toBe('like')
    })
})
