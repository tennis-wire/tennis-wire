import { describe, expect, it } from 'vitest'

import { finals, knockout, SCENARIOS, seedOrder, type KnockoutOptions } from './fixtures'
import { isDone, matchesOf } from './rounds'
import type { Knockout, Side } from './types'

const START = '2026-06-29T00:00:00Z'

const base: KnockoutOptions = {
    seed: 11,
    prefix: 't',
    slots: 32,
    seeds: 8,
    bestOf: 3,
    start: START,
}

const entryId = (side: Side) => (side.kind === 'entry' ? side.entry.id : side.kind)

// The winner of match k is the a side of match ceil(k / 2) when k is odd, the b side when even
function advancesConsistently(stage: Knockout) {
    for (let round = 1; round < stage.rounds; round++) {
        for (const match of matchesOf(stage, round)) {
            if (!match.winner) continue
            const into = matchesOf(stage, round + 1)[Math.ceil(match.number / 2) - 1]
            const side = match.number % 2 === 1 ? into.a : into.b
            expect(entryId(side)).toBe(entryId(match[match.winner]))
        }
    }
}

describe('seedOrder', () => {
    it('keeps the first two seeds at either end and apart until the final', () => {
        const order = seedOrder(32)

        expect(order[0]).toBe(1)
        expect(order[31]).toBe(2)
        expect(new Set(order).size).toBe(32)
        expect(order.slice(0, 16)).not.toContain(2)
    })
})

describe('knockout', () => {
    it('is the same draw for the same seed', () => {
        expect(knockout(base)).toEqual(knockout(base))
    })

    it('halves the matches each round and numbers them in order', () => {
        const stage = knockout({ ...base, slots: 128, seeds: 32, bestOf: 5 })

        expect(stage.rounds).toBe(7)
        for (let round = 1; round <= 7; round++) {
            expect(matchesOf(stage, round).map((m) => m.number)).toEqual(
                Array.from({ length: 2 ** (7 - round) }, (_, i) => i + 1)
            )
        }
        advancesConsistently(stage)
    })

    it('plays the whole draw to one champion when told nothing else', () => {
        const stage = knockout(base)

        expect(stage.matches.every(isDone)).toBe(true)
        expect(matchesOf(stage, stage.rounds)[0].winner).toBeDefined()
    })

    it('gives the byes to the top seeds', () => {
        const stage = knockout({ ...base, byes: 4 })
        const byes = matchesOf(stage, 1).filter((m) => m.a.kind === 'bye' || m.b.kind === 'bye')

        expect(byes).toHaveLength(4)
        const seeds = byes.map((m) => {
            const side = m.a.kind === 'entry' ? m.a : m.b
            return side.kind === 'entry' ? side.entry.seed : undefined
        })
        expect(seeds.sort()).toEqual([1, 2, 3, 4])
        advancesConsistently(stage)
    })

    it('stops partway with one match live and the rest of the round to come', () => {
        const stage = knockout({ ...base, upTo: 3 })

        expect(matchesOf(stage, 1).every(isDone)).toBe(true)
        expect(matchesOf(stage, 2).every(isDone)).toBe(true)
        expect(stage.matches.filter((m) => m.status === 'live')).toHaveLength(1)
        expect(matchesOf(stage, 3).find((m) => m.status === 'live')?.live).toBeDefined()
        expect(matchesOf(stage, 5)[0].a.kind).toBe('pending')
        advancesConsistently(stage)
    })

    it('writes a pair as two players', () => {
        const stage = knockout({ ...base, slots: 16, seeds: 4, doubles: true })
        const side = matchesOf(stage, 1)[0].a

        expect(side.kind === 'entry' && side.entry.players).toHaveLength(2)
    })
})

describe('finals', () => {
    it('puts the top two of each group into the semi-finals once the groups are over', () => {
        const [groups, playoff] = finals({ seed: 3, prefix: 'f', played: 3, start: START })

        expect(groups.kind).toBe('groups')
        expect(playoff.kind).toBe('knockout')
        if (groups.kind !== 'groups' || playoff.kind !== 'knockout') return
        for (const group of groups.groups) {
            expect(group.rows.filter((r) => r.qualified)).toHaveLength(2)
            expect(group.matches).toHaveLength(6)
        }
        expect(
            matchesOf(playoff, 1).every((m) => m.a.kind === 'entry' && m.b.kind === 'entry')
        ).toBe(true)
    })

    it('names the semi-final places by group while the groups are still on', () => {
        const [, playoff] = finals({ seed: 3, prefix: 'f', played: 1, start: START })

        if (playoff.kind !== 'knockout') throw new Error('playoff expected')
        expect(matchesOf(playoff, 1)[0].a).toEqual({ kind: 'pending', label: '1-й группы А' })
    })
})

describe('SCENARIOS', () => {
    it('builds every scenario', () => {
        for (const scenario of SCENARIOS) {
            expect(scenario.draws().length).toBeGreaterThan(0)
        }
    })
})
