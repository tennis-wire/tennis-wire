// A draw as architecture/tennis-data.md section 4 has it, as far as a page needs it. Nothing of a
// provider's shape leaks in: an adapter produces this, and so do the fixtures.

export type DrawKind = 'ms' | 'ws' | 'md' | 'wd' | 'xd'

export type EntryType = 'Q' | 'WC' | 'LL' | 'PR' | 'SE' | 'ALT'

// lastName is what a doubles pair is written with
export type Player = { id: string; name: string; lastName: string }

// One player, or two in doubles
export type Entry = {
    id: string
    players: Player[]
    seed?: number
    entryType?: EntryType
}

// A side not known yet can say what decides it: "1-й группы А". Without a label it is "Определится"
export type Side =
    { kind: 'entry'; entry: Entry } | { kind: 'bye' } | { kind: 'pending'; label?: string }

export type SideKey = 'a' | 'b'

// Games of a set, and the points of its tiebreak if it had one. A match tiebreak in place of a
// deciding set keeps its points in a and b.
export type SetScore = {
    a: number
    b: number
    tiebreak?: { a: number; b: number }
    matchTiebreak?: boolean
}

export type MatchStatus =
    | 'scheduled'
    | 'live'
    | 'suspended'
    | 'finished'
    | 'retired'
    | 'walkover'
    | 'defaulted'
    | 'cancelled'

// The game being played: who serves, and the points as the umpire calls them
export type LiveGame = { server: SideKey; a: string; b: string }

export type Match = {
    id: string
    // 1-based within the stage. The number places the match in the tree: the winner of match k
    // goes on to match ceil(k / 2) of the next round
    round: number
    number: number
    a: Side
    b: Side
    status: MatchStatus
    sets: SetScore[]
    winner?: SideKey
    scheduledAt?: string
    court?: string
    live?: LiveGame
}

export type Knockout = { kind: 'knockout'; rounds: number; matches: Match[] }

// The order comes from the provider: tie-break rules differ between the tours
export type GroupRow = {
    entry: Entry
    won: number
    lost: number
    setsWon: number
    setsLost: number
    qualified: boolean
}

export type Group = { id: string; name: string; rows: GroupRow[]; matches: Match[] }

export type Groups = { kind: 'groups'; groups: Group[] }

export type Stage = Knockout | Groups

export type Draw = { id: string; kind: DrawKind; qualifying: boolean; stages: Stage[] }
