import { describe, expect, it } from 'vitest'

import { percent, sameChoice, shifted, toggled, type Poll } from './polls'

const poll: Poll = {
    id: 'p',
    question: 'Who?',
    closesAt: null,
    closed: false,
    multipleChoice: false,
    voteCount: 3,
    options: [
        { id: 'a', text: 'A', voteCount: 2 },
        { id: 'b', text: 'B', voteCount: 1 },
        { id: 'c', text: 'C', voteCount: 0 },
    ],
    viewerOptionIds: [],
}

const several: Poll = { ...poll, multipleChoice: true }

const counts = (p: Poll) => [...p.options.map((o) => o.voteCount), p.voteCount]

describe('shifted', () => {
    it('adds a first vote, moves it, and takes it back', () => {
        const voted = shifted(poll, ['a'])
        expect(counts(voted)).toEqual([3, 1, 0, 4])
        expect(voted.viewerOptionIds).toEqual(['a'])

        const moved = shifted(voted, ['b'])
        expect(counts(moved)).toEqual([2, 2, 0, 4])

        const gone = shifted(moved, [])
        expect(counts(gone)).toEqual([2, 1, 0, 3])
        expect(gone.viewerOptionIds).toEqual([])
    })

    it('counts a reader once however many options he takes', () => {
        const one = shifted(several, ['b'])
        expect(counts(one)).toEqual([2, 2, 0, 4])

        const two = shifted(one, ['c', 'b'])
        expect(counts(two)).toEqual([2, 2, 1, 4])
        expect(two.viewerOptionIds).toEqual(['b', 'c'])

        expect(counts(shifted(two, []))).toEqual([2, 1, 0, 3])
    })

    it('does nothing for the choice already held, in whatever order', () => {
        const voted = shifted(several, ['a', 'b'])
        expect(shifted(voted, ['b', 'a'])).toBe(voted)
        expect(shifted(poll, [])).toBe(poll)
    })
})

describe('toggled', () => {
    it('takes one option at a time in a single-choice poll', () => {
        expect(toggled(poll, 'a')).toEqual(['a'])
        expect(toggled({ ...poll, viewerOptionIds: ['a'] }, 'b')).toEqual(['b'])
        expect(toggled({ ...poll, viewerOptionIds: ['a'] }, 'a')).toEqual([])
    })

    it('puts an option in or out of the choice in a multiple-choice poll', () => {
        expect(toggled({ ...several, viewerOptionIds: ['a'] }, 'c')).toEqual(['a', 'c'])
        expect(toggled({ ...several, viewerOptionIds: ['a', 'c'] }, 'a')).toEqual(['c'])
    })
})

describe('sameChoice', () => {
    it('ignores the order', () => {
        expect(sameChoice(['a', 'b'], ['b', 'a'])).toBe(true)
        expect(sameChoice(['a'], ['a', 'b'])).toBe(false)
        expect(sameChoice([], [])).toBe(true)
    })
})

describe('percent', () => {
    it('is a whole number of the readers who voted, and zero of nothing', () => {
        expect(percent(poll.options[0], poll)).toBe(67)
        expect(percent(poll.options[1], poll)).toBe(33)
        expect(percent(poll.options[0], { ...poll, voteCount: 0 })).toBe(0)
    })
})
