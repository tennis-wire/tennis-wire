import { describe, expect, it } from 'vitest'

import { percent, shifted, type Poll } from './polls'

const poll: Poll = {
    id: 'p',
    question: 'Who?',
    closesAt: null,
    closed: false,
    voteCount: 3,
    options: [
        { id: 'a', text: 'A', voteCount: 2 },
        { id: 'b', text: 'B', voteCount: 1 },
    ],
    viewerOptionId: null,
}

const counts = (p: Poll) => [p.options[0].voteCount, p.options[1].voteCount, p.voteCount]

describe('shifted', () => {
    it('adds a first vote, moves it, and takes it back', () => {
        const voted = shifted(poll, 'a')
        expect(counts(voted)).toEqual([3, 1, 4])
        expect(voted.viewerOptionId).toBe('a')

        const moved = shifted(voted, 'b')
        expect(counts(moved)).toEqual([2, 2, 4])

        const gone = shifted(moved, null)
        expect(counts(gone)).toEqual([2, 1, 3])
        expect(gone.viewerOptionId).toBeNull()
    })

    it('does nothing for the choice already held', () => {
        const voted = shifted(poll, 'a')
        expect(shifted(voted, 'a')).toBe(voted)
        expect(shifted(poll, null)).toBe(poll)
    })
})

describe('percent', () => {
    it('is a whole number of the total, and zero of nothing', () => {
        expect(percent(poll.options[0], poll)).toBe(67)
        expect(percent(poll.options[1], poll)).toBe(33)
        expect(percent(poll.options[0], { ...poll, voteCount: 0 })).toBe(0)
    })
})
