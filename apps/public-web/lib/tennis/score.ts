import type { Match, SideKey } from './types'

// One side's cell of one set. The tiebreak points go on the side that lost the set, as score
// lines print them: 7-6 with a small 5 under the 6.
export type SetCell = { games: number; tiebreak?: number; won: boolean }

const other = (side: SideKey): SideKey => (side === 'a' ? 'b' : 'a')

export function setCells(match: Match, side: SideKey): SetCell[] {
    return match.sets.map((set) => {
        const games = set[side]
        const won = games > set[other(side)]
        if (!set.tiebreak || set.matchTiebreak || won) return { games, won }
        return { games, tiebreak: set.tiebreak[side], won }
    })
}

// The score as text, from the winner's side when there is one: "6:4, 7:6 (5)"
export function scoreLine(match: Match): string {
    const first = match.winner ?? 'a'
    const second = other(first)
    return match.sets
        .map((set) => {
            const line = `${set[first]}:${set[second]}`
            if (!set.tiebreak || set.matchTiebreak) return line
            const loser = set[first] > set[second] ? second : first
            return `${line} (${set.tiebreak[loser]})`
        })
        .join(', ')
}
