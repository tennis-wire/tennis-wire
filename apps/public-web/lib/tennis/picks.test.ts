import { describe, expect, it } from 'vitest'

import { choose, project, type Picks } from './picks'
import type { Entry, Knockout, Match, MatchStatus, Side, SideKey } from './types'

const entry = (id: string): Entry => ({
    id,
    players: [{ id: `p${id}`, name: `Игрок ${id}`, lastName: id }],
})

const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(entry)

const side = (e?: Entry): Side => (e ? { kind: 'entry', entry: e } : { kind: 'pending' })

function match(
    round: number,
    number: number,
    a?: Entry,
    b?: Entry,
    status: MatchStatus = 'scheduled',
    winner?: SideKey
): Match {
    return {
        id: `r${round}m${number}`,
        round,
        number,
        a: side(a),
        b: side(b),
        status,
        sets: [],
        winner,
    }
}

// Two semi-finals and a final
function draw(semis: [Match, Match], final?: Match): Knockout {
    return { kind: 'knockout', rounds: 2, matches: [...semis, final ?? match(2, 1)] }
}

const open = draw([match(1, 1, A, B), match(1, 2, C, D)])

const sideIn = (stage: Knockout, picks: Picks, id: string, key: SideKey) => {
    const s = project(stage, picks).get(id)?.[key]
    return s?.kind === 'entry' ? s.entry.id : s?.kind
}

describe('choose and project', () => {
    it('sends a player through to the next round', () => {
        const picks = choose(open, {}, open.matches[0], 'A')
        const views = project(open, picks)

        expect(views.get('r1m1')).toMatchObject({ winner: 'a', marks: { a: 'picked' } })
        expect(sideIn(open, picks, 'r2m1', 'a')).toBe('A')
        expect(views.get('r2m1')?.pickable).toBe(false)
    })

    it('takes back the rounds after when he changes his mind', () => {
        let picks = choose(open, {}, open.matches[0], 'A')
        picks = choose(open, picks, open.matches[1], 'C')
        picks = choose(open, picks, open.matches[2], 'A')

        picks = choose(open, picks, open.matches[0], 'B')

        expect(picks).toEqual({ r1m1: 'B', r1m2: 'C' })
        expect(sideIn(open, picks, 'r2m1', 'a')).toBe('B')
        expect(project(open, picks).get('r2m1')?.winner).toBeUndefined()
    })

    it('takes a player back with a second tap, and his later rounds with him', () => {
        let picks = choose(open, {}, open.matches[0], 'A')
        picks = choose(open, picks, open.matches[1], 'C')
        picks = choose(open, picks, open.matches[2], 'A')

        picks = choose(open, picks, open.matches[0], 'A')

        expect(picks).toEqual({ r1m2: 'C' })
    })

    it('ignores a choice for someone no longer in the match', () => {
        const views = project(open, { r2m1: 'D' })

        expect(views.get('r2m1')?.winner).toBeUndefined()
    })
})

describe('project over real results', () => {
    const played = draw([match(1, 1, A, B, 'finished', 'b'), match(1, 2, C, D)], match(2, 1, B))

    it('marks a right choice once the result is in', () => {
        const views = project(played, { r1m1: 'B' })

        expect(views.get('r1m1')?.marks).toEqual({ b: 'right' })
        expect(sideIn(played, { r1m1: 'B' }, 'r2m1', 'a')).toBe('B')
    })

    it('marks a wrong one and keeps his player on, struck through', () => {
        const views = project(played, { r1m1: 'A' })

        expect(views.get('r1m1')?.marks).toEqual({ a: 'wrong' })
        expect(views.get('r1m1')?.winner).toBe('b')
        expect(sideIn(played, { r1m1: 'A' }, 'r2m1', 'a')).toBe('A')
        expect(views.get('r2m1')?.marks.a).toBe('out')
    })

    it('without a choice his draw follows the real one', () => {
        expect(sideIn(played, {}, 'r2m1', 'a')).toBe('B')
    })

    it('says whom he picked in a played match his player never reached', () => {
        const over = draw(
            [match(1, 1, A, B, 'finished', 'b'), match(1, 2, C, D, 'finished', 'a')],
            match(2, 1, B, C, 'finished', 'a')
        )

        const views = project(over, { r1m1: 'A', r2m1: 'A' })

        expect(views.get('r2m1')?.missed?.id).toBe('A')
        expect(views.get('r2m1')?.pickable).toBe(false)
    })
})
