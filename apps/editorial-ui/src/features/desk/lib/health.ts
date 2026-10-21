// What the newsroom is told about the sources' health (architecture/aggregator.md 5.2).
// The collector judges; this only puts its judgement into words.

import type { HealthSnapshot, Source } from '../types/aggregator'
import { clockOf } from './when'

// The collector sends every source's snapshot at least every 15 minutes: twice that and silence
// means the collector itself is down, not one site
export const COLLECTOR_SILENT_AFTER_MS = 30 * 60 * 1000

export interface SourceProblem {
    source: string
    text: string
}

function textOf(kind: string, health: HealthSnapshot): string {
    switch (kind) {
        case 'blocked':
            return health.blockedSince
                ? `сайт блокирует сбор с ${clockOf(health.blockedSince)}`
                : 'сайт блокирует сбор'
        case 'failing':
            return `не открывается, ${health.failuresInRow} попыток подряд`
        case 'extraction':
            return 'текст статей не извлекается, будет только заголовок и лид'
        case 'quiet':
            return health.lastNewAt
                ? `нет новых новостей с ${clockOf(health.lastNewAt)}`
                : 'новых новостей давно нет'
        default:
            return kind
    }
}

// One line per problem of a source still collected
export function problemsOf(sources: Source[]): SourceProblem[] {
    return sources
        .filter((source) => !source.retired && source.health !== null)
        .flatMap((source) =>
            source.health!.problems.map((problem) => ({
                source: source.name,
                text: textOf(problem.kind, source.health!),
            }))
        )
}

export function hasProblems(source: Source): boolean {
    return !source.retired && (source.health?.problems.length ?? 0) > 0
}

// Since when nothing has been heard from the collector, or null while it keeps reporting.
// Null as well before it has ever reported: there is nothing to have stopped
export function collectorSilentSince(sources: Source[], now: Date): Date | null {
    const heard = sources
        .filter((source) => !source.retired && source.healthAt !== null)
        .map((source) => new Date(source.healthAt!).getTime())
    if (heard.length === 0) return null
    const last = Math.max(...heard)
    return now.getTime() - last > COLLECTOR_SILENT_AFTER_MS ? new Date(last) : null
}
