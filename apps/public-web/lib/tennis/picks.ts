import { isDone, matchesOf } from './rounds'
import type { Entry, Knockout, Match, Side, SideKey } from './types'

// A reader's own draw: who he sends through each match, by entry id. Only his: kept in his browser
export type Picks = Record<string, string>

// picked: his choice in a match still to be decided. right and wrong: his choice once the real
// result came. out: a player he sent on who has really lost since.
export type Mark = 'picked' | 'right' | 'wrong' | 'out'

export type ProjectedMatch = {
    // The real match: status, score, time and court always come from it
    match: Match
    // The sides the reader sees: the real ones once the match is played, his own before that
    a: Side
    b: Side
    winner?: SideKey
    marks: Partial<Record<SideKey, Mark>>
    // He picked someone who never got to this match: said under it
    missed?: Entry
    pickable: boolean
}

const entryOf = (side: Side): Entry | undefined => (side.kind === 'entry' ? side.entry : undefined)

const keyOf = (match: Match, entryId: string): SideKey | undefined =>
    entryOf(match.a)?.id === entryId ? 'a' : entryOf(match.b)?.id === entryId ? 'b' : undefined

// Everyone who has really lost a match: a reader's draw that still has them further on shows them
// struck through
function losers(stage: Knockout): Set<string> {
    const out = new Set<string>()
    for (const match of stage.matches) {
        if (!isDone(match) || !match.winner) continue
        const lost = entryOf(match[match.winner === 'a' ? 'b' : 'a'])
        if (lost) out.add(lost.id)
    }
    return out
}

function entriesOf(stage: Knockout): Map<string, Entry> {
    const all = new Map<string, Entry>()
    for (const match of stage.matches) {
        for (const side of [match.a, match.b]) {
            const entry = entryOf(side)
            if (entry) all.set(entry.id, entry)
        }
    }
    return all
}

// The draw as the reader built it on top of the real one, round by round. A side comes from what
// he sent through the match before it, or from the real draw where he sent nobody.
export function project(stage: Knockout, picks: Picks): Map<string, ProjectedMatch> {
    const out = losers(stage)
    const entries = entriesOf(stage)
    const through = new Map<string, Entry | undefined>()
    const views = new Map<string, ProjectedMatch>()

    for (let round = 1; round <= stage.rounds; round++) {
        const before = round > 1 ? matchesOf(stage, round - 1) : []
        for (const match of matchesOf(stage, round)) {
            const fed = (number: number, real: Side): Side => {
                const feeder = before[number - 1]
                const entry = feeder ? through.get(feeder.id) : undefined
                return entry ? { kind: 'entry', entry } : real
            }
            const a = round === 1 ? match.a : fed(2 * match.number - 1, match.a)
            const b = round === 1 ? match.b : fed(2 * match.number, match.b)
            const pick = picks[match.id]
            const valid = pick !== undefined && (entryOf(a)?.id === pick || entryOf(b)?.id === pick)

            if (isDone(match)) {
                const real = match.winner ? entryOf(match[match.winner]) : undefined
                const marks: ProjectedMatch['marks'] = {}
                let missed: Entry | undefined
                if (valid) {
                    const side = keyOf(match, pick)
                    if (side) marks[side] = side === match.winner ? 'right' : 'wrong'
                    else missed = entries.get(pick)
                }
                // His draw goes on with his own choice, right or wrong: that is what lets a
                // player who went out show struck through further on
                through.set(match.id, valid ? entries.get(pick) : real)
                views.set(match.id, {
                    match,
                    a: match.a,
                    b: match.b,
                    winner: match.winner,
                    marks,
                    missed,
                    pickable: false,
                })
                continue
            }

            const marks: ProjectedMatch['marks'] = {}
            for (const key of ['a', 'b'] as const) {
                const entry = entryOf(key === 'a' ? a : b)
                if (entry && out.has(entry.id)) marks[key] = 'out'
                else if (valid && entry?.id === pick) marks[key] = 'picked'
            }
            const winner: SideKey | undefined = valid
                ? entryOf(a)?.id === pick
                    ? 'a'
                    : 'b'
                : undefined
            through.set(match.id, valid ? entries.get(pick) : undefined)
            views.set(match.id, {
                match,
                a,
                b,
                winner,
                marks,
                pickable: a.kind === 'entry' && b.kind === 'entry',
            })
        }
    }
    return views
}

// The match the winner of this one goes on to, or undefined after the final
function nextOf(stage: Knockout, match: Match): Match | undefined {
    return matchesOf(stage, match.round + 1)[Math.ceil(match.number / 2) - 1]
}

// Takes a player off the path he was sent along from this match on
function clear(stage: Knockout, picks: Picks, from: Match, entryId: string) {
    let next = nextOf(stage, from)
    while (next && picks[next.id] === entryId) {
        delete picks[next.id]
        next = nextOf(stage, next)
    }
}

// A tap on a player: sends him through, or takes him back if he was already sent. Whoever was
// sent before him comes off the rounds after, since he no longer gets there.
export function choose(stage: Knockout, picks: Picks, match: Match, entryId: string): Picks {
    const next = { ...picks }
    const before = next[match.id]
    if (before !== undefined) clear(stage, next, match, before)
    if (before === entryId) {
        delete next[match.id]
    } else {
        next[match.id] = entryId
    }
    return next
}
