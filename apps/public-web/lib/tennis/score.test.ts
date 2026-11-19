import { describe, expect, it } from 'vitest'

import { entryName } from './names'
import { scoreLine, setCells } from './score'
import type { Entry, Match } from './types'

const single: Entry = {
    id: 'e1',
    players: [{ id: 'p1', name: 'Марко Ресселли', lastName: 'Ресселли' }],
}

const pair: Entry = {
    id: 'e2',
    players: [
        { id: 'p2', name: 'Лукас Варга', lastName: 'Варга' },
        { id: 'p3', name: 'Феликс Брандт', lastName: 'Брандт' },
    ],
}

function match(over: Partial<Match>): Match {
    return {
        id: 'm',
        round: 1,
        number: 1,
        a: { kind: 'entry', entry: single },
        b: { kind: 'entry', entry: pair },
        status: 'finished',
        sets: [],
        ...over,
    }
}

describe('setCells', () => {
    it('puts the tiebreak points on the side that lost the set', () => {
        const m = match({ sets: [{ a: 7, b: 6, tiebreak: { a: 7, b: 5 } }], winner: 'a' })

        expect(setCells(m, 'a')).toEqual([{ games: 7, won: true }])
        expect(setCells(m, 'b')).toEqual([{ games: 6, tiebreak: 5, won: false }])
    })

    it('shows a match tiebreak as its points, with nothing under them', () => {
        const m = match({ sets: [{ a: 10, b: 8, matchTiebreak: true }], winner: 'a' })

        expect(setCells(m, 'b')).toEqual([{ games: 8, won: false }])
    })
})

describe('scoreLine', () => {
    it('reads from the winner, tiebreak in brackets', () => {
        const m = match({
            sets: [
                { a: 4, b: 6 },
                { a: 6, b: 7, tiebreak: { a: 3, b: 7 } },
            ],
            winner: 'b',
        })

        expect(scoreLine(m)).toBe('6:4, 7:6 (3)')
    })
})

describe('entryName', () => {
    it('writes a player in full and a pair by surnames', () => {
        expect(entryName(single)).toBe('Марко Ресселли')
        expect(entryName(pair)).toBe('Варга / Брандт')
    })
})
