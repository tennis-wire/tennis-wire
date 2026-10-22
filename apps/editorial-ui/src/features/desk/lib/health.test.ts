import { describe, expect, it } from 'vitest'

import type { HealthSnapshot, Source } from '../types/aggregator'
import { collectorSilentSince, hasProblems, problemsOf } from './health'

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
    return {
        problems: [],
        lastRunAt: null,
        lastStatus: 'ok',
        lastOkAt: null,
        lastNewAt: null,
        failuresInRow: 0,
        blockedSince: null,
        blockKind: null,
        ...overrides,
    }
}

function source(key: string, overrides: Partial<Source> = {}): Source {
    return {
        key,
        name: key,
        language: 'en',
        siteUrl: `https://${key}.example.com/`,
        retired: false,
        health: snapshot(),
        healthAt: '2026-10-21T12:00:00Z',
        ...overrides,
    }
}

const NOON = new Date('2026-10-21T12:10:00Z')

describe('health', () => {
    it('puts each problem into words, with the figures the snapshot carries', () => {
        const sources = [
            source('Eurosport DE', {
                health: snapshot({
                    problems: [{ kind: 'blocked', detail: 'challenge since …' }],
                    blockedSince: '2026-10-21T09:40:00Z',
                }),
            }),
            source('sports.ru', {
                health: snapshot({
                    problems: [
                        { kind: 'failing', detail: null },
                        { kind: 'extraction', detail: null },
                    ],
                    failuresInRow: 5,
                }),
            }),
            source('Tennis Majors'),
        ]

        const problems = problemsOf(sources)

        expect(problems.map((p) => p.source)).toEqual(['Eurosport DE', 'sports.ru', 'sports.ru'])
        expect(problems[0].text).toMatch(/^сайт блокирует сбор с /)
        expect(problems[1].text).toBe('не открывается, 5 попыток подряд')
        expect(problems[2].text).toBe('текст статей не извлекается, будет только заголовок и лид')
        expect(sources.map(hasProblems)).toEqual([true, true, false])
    })

    it('says nothing of a retired source', () => {
        const retired = source('old', {
            retired: true,
            health: snapshot({ problems: [{ kind: 'quiet', detail: null }] }),
        })

        expect(problemsOf([retired])).toEqual([])
        expect(hasProblems(retired)).toBe(false)
    })

    it('calls the collector silent once no snapshot is newer than half an hour', () => {
        const fresh = [source('a', { healthAt: '2026-10-21T11:50:00Z' }), source('b')]
        const stale = [
            source('a', { healthAt: '2026-10-21T11:30:00Z' }),
            source('b', { healthAt: '2026-10-21T11:35:00Z' }),
        ]

        expect(collectorSilentSince(fresh, NOON)).toBeNull()
        expect(collectorSilentSince(stale, NOON)?.toISOString()).toBe('2026-10-21T11:35:00.000Z')
    })

    it('has nothing to call silent before the collector ever reported', () => {
        expect(
            collectorSilentSince([source('a', { health: null, healthAt: null })], NOON)
        ).toBeNull()
    })
})
