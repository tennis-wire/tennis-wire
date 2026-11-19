import { describe, expect, it } from 'vitest'

import { openingRound, roundName, shownRounds } from './rounds'
import type { Knockout, Match, MatchStatus, Side } from './types'

const player: Side = {
    kind: 'entry',
    entry: { id: 'e', players: [{ id: 'p', name: 'Имя Фамилия', lastName: 'Фамилия' }] },
}

function match(round: number, number: number, status: MatchStatus, sides = true): Match {
    return {
        id: `r${round}m${number}`,
        round,
        number,
        a: sides ? player : { kind: 'pending' },
        b: sides ? player : { kind: 'pending' },
        status,
        sets: [],
    }
}

const stage = (rounds: number, matches: Match[]): Knockout => ({
    kind: 'knockout',
    rounds,
    matches,
})

describe('roundName', () => {
    it('names the last four rounds of a 128 draw by fraction and the rest by number', () => {
        const names = [1, 2, 3, 4, 5, 6, 7].map((round) => roundName(round, 7))

        expect(names).toEqual([
            { number: 1 },
            { number: 2 },
            { number: 3 },
            { fraction: 16 },
            { fraction: 8 },
            { fraction: 4 },
            { fraction: 2 },
        ])
    })

    it('calls the first round of a 32 draw a round, not 1/16', () => {
        expect(roundName(1, 5)).toEqual({ number: 1 })
        expect(roundName(2, 5)).toEqual({ fraction: 16 })
    })
})

describe('openingRound', () => {
    it('opens on the round being played', () => {
        const s = stage(3, [
            match(1, 1, 'finished'),
            match(1, 2, 'finished'),
            match(2, 1, 'live'),
            match(3, 1, 'scheduled', false),
        ])

        expect(openingRound(s)).toBe(2)
    })

    it('then on the next round that can be played', () => {
        const s = stage(3, [
            match(1, 1, 'finished'),
            match(1, 2, 'finished'),
            match(2, 1, 'scheduled'),
            match(3, 1, 'scheduled', false),
        ])

        expect(openingRound(s)).toBe(2)
    })

    it('shows the last three rounds once it is all over', () => {
        const s = stage(7, [match(7, 1, 'finished')])

        expect(openingRound(s)).toBe(5)
    })
})

describe('shownRounds', () => {
    it('takes three from the chosen one, fewer at the end', () => {
        expect(shownRounds(2, 7)).toEqual([2, 3, 4])
        expect(shownRounds(6, 7)).toEqual([6, 7])
    })
})
