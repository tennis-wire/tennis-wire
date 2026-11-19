import type { Entry, Side } from './types'

// A pair is written by surnames: two full names do not fit a draw line
export function entryName(entry: Entry): string {
    if (entry.players.length > 1) return entry.players.map((player) => player.lastName).join(' / ')
    return entry.players[0]?.name ?? ''
}

// null for a side that is not a player yet: the caller words it
export function sideName(side: Side): string | null {
    return side.kind === 'entry' ? entryName(side.entry) : null
}
