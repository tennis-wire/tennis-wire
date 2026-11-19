import type { Knockout, Match, MatchStatus } from './types'

// How Russian tennis writing names a round: the last four by their fraction of the final, the
// earlier ones by number. 1/16 is left out on purpose: in a 32 draw it is the first round.
export type RoundName = { fraction: 2 | 4 | 8 | 16 } | { number: number }

export function roundName(round: number, rounds: number): RoundName {
    const left = 2 ** (rounds - round + 1)
    if (left === 2 || left === 4 || left === 8 || left === 16) return { fraction: left }
    return { number: round }
}

const DONE: ReadonlySet<MatchStatus> = new Set([
    'finished',
    'retired',
    'walkover',
    'defaulted',
    'cancelled',
])

export const isDone = (match: Match) => DONE.has(match.status)

export function matchesOf(stage: Knockout, round: number): Match[] {
    return stage.matches
        .filter((match) => match.round === round)
        .sort((x, y) => x.number - y.number)
}

const playable = (match: Match) =>
    !isDone(match) && match.a.kind === 'entry' && match.b.kind === 'entry'

// Where the reader is taken first: the round being played, then the next one to be. Once it is
// all over, the last three, where the story of the draw is.
export function openingRound(stage: Knockout, shown = 3): number {
    const live = stage.matches.filter((match) => match.status === 'live')
    if (live.length > 0) return Math.min(...live.map((match) => match.round))
    const next = stage.matches.filter(playable)
    if (next.length > 0) return Math.min(...next.map((match) => match.round))
    const open = stage.matches.filter((match) => !isDone(match))
    if (open.length > 0) return Math.min(...open.map((match) => match.round))
    return Math.max(1, stage.rounds - shown + 1)
}

// The rounds drawn side by side from the chosen one on
export function shownRounds(chosen: number, rounds: number, shown = 3): number[] {
    const last = Math.min(rounds, chosen + shown - 1)
    return Array.from({ length: last - chosen + 1 }, (_, i) => chosen + i)
}
