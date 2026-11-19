import LocalDay from '@/components/LocalDay'
import { entryName, sideName } from '@/lib/tennis/names'
import type { Mark, ProjectedMatch } from '@/lib/tennis/picks'
import { scoreLine, setCells } from '@/lib/tennis/score'
import type { Match, Side, SideKey } from '@/lib/tennis/types'

import { strings } from './strings'

const card: React.CSSProperties = {
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
    background: 'var(--tw-surface)',
    fontSize: 14,
    minWidth: 0,
    overflow: 'hidden',
}

const head: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    padding: '5px 10px',
    fontSize: 12,
    color: 'var(--tw-text-muted)',
    borderBottom: '1px solid var(--tw-border)',
    whiteSpace: 'nowrap',
}

const badge: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'var(--tw-on-live)',
    background: 'var(--tw-live)',
    padding: '1px 6px',
    borderRadius: 3,
}

const line = (bold: boolean, quiet: boolean, chosen: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 10px',
    fontWeight: bold ? 600 : 400,
    color: quiet ? 'var(--tw-text-muted)' : bold ? 'var(--tw-text)' : 'var(--tw-text-secondary)',
    background: chosen ? 'var(--tw-tag)' : 'transparent',
})

// A line the reader can tap: a button that looks like the line it is
const tappable: React.CSSProperties = {
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
}

const name: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
}

const clipped: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

const small: React.CSSProperties = { fontSize: 12, color: 'var(--tw-text-muted)', fontWeight: 400 }

const numbers: React.CSSProperties = {
    display: 'flex',
    gap: 2,
    fontVariantNumeric: 'tabular-nums',
}

const cell: React.CSSProperties = { width: 18, textAlign: 'center' }

const points: React.CSSProperties = {
    ...cell,
    width: 26,
    marginLeft: 4,
    borderRadius: 5,
    background: 'var(--tw-tag)',
    color: 'var(--tw-primary)',
    fontWeight: 600,
}

const server: React.CSSProperties = {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: '50%',
    background: 'var(--tw-accent)',
}

const markColor: Record<Mark, string> = {
    picked: 'var(--tw-primary)',
    right: 'var(--tw-primary)',
    wrong: 'var(--tw-live)',
    out: 'var(--tw-text-muted)',
}

const missedLine: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 12,
    color: 'var(--tw-text-muted)',
    borderTop: '1px solid var(--tw-border)',
}

const entryId = (side: Side) => (side.kind === 'entry' ? side.entry.id : null)

// The real draw seen as is: the sides it has, nothing of the reader's
export function asIs(match: Match): ProjectedMatch {
    return { match, a: match.a, b: match.b, winner: match.winner, marks: {}, pickable: false }
}

function Head({ match }: { match: Match }) {
    const said = match.status in strings.status
    return (
        <div style={head}>
            <span>
                {match.status === 'live' ? (
                    <span style={badge}>{strings.live}</span>
                ) : said ? (
                    strings.status[match.status as keyof typeof strings.status]
                ) : match.scheduledAt ? (
                    <LocalDay iso={match.scheduledAt} withTime={match.status === 'scheduled'} />
                ) : null}
            </span>
            {match.court && <span style={clipped}>{match.court}</span>}
        </div>
    )
}

type LineProps = { view: ProjectedMatch; side: SideKey; onPick?: (entryId: string) => void }

function Line({ view, side, onPick }: LineProps) {
    const { match } = view
    const what = view[side]
    if (what.kind !== 'entry') {
        return (
            <div style={line(false, true, false)}>
                <span style={clipped}>
                    {what.kind === 'bye' ? strings.bye : (what.label ?? strings.pending)}
                </span>
            </div>
        )
    }
    const { entry } = what
    const mark = view.marks[side]
    // The score is the real players': none of it next to someone the reader put here himself
    const real = entryId(what) === entryId(match[side])
    const serving = real && match.status === 'live' && match.live?.server === side
    const out = mark === 'out'
    const inside = (
        <>
            <span style={name}>
                {serving && <span role="img" aria-label={strings.serving} style={server} />}
                <span style={{ ...clipped, textDecoration: out ? 'line-through' : undefined }}>
                    {entryName(entry)}
                </span>
                {entry.seed !== undefined && <span style={small}>({entry.seed})</span>}
                {entry.entryType && <span style={small}>{entry.entryType}</span>}
                {mark && (
                    <span
                        role="img"
                        aria-label={strings.marks[mark].label}
                        style={{ color: markColor[mark], fontWeight: 700 }}
                    >
                        {strings.marks[mark].glyph}
                    </span>
                )}
            </span>
            {real && (
                <span style={numbers}>
                    {setCells(match, side).map((set, i) => (
                        <span key={i} style={cell}>
                            {set.games}
                            {set.tiebreak !== undefined && (
                                <sup style={{ fontSize: 9 }}>{set.tiebreak}</sup>
                            )}
                        </span>
                    ))}
                    {match.status === 'live' && match.live && (
                        <span style={points}>{match.live[side]}</span>
                    )}
                </span>
            )}
        </>
    )
    const style = line(view.winner === side && !out, out, mark === 'picked')
    if (onPick && view.pickable && !out) {
        return (
            <button
                type="button"
                aria-pressed={mark === 'picked'}
                style={{ ...style, ...tappable }}
                onClick={() => onPick(entry.id)}
            >
                {inside}
            </button>
        )
    }
    return <div style={style}>{inside}</div>
}

type Props = {
    match: Match
    // The reader's own draw over this match; without it the match is shown as it is
    view?: ProjectedMatch
    onPick?: (entryId: string) => void
}

export default function MatchCard({ match, view = asIs(match), onPick }: Props) {
    const a = sideName(view.a) ?? strings.pending
    const b = sideName(view.b) ?? strings.pending
    const winner = match.winner ? sideName(match[match.winner]) : null
    return (
        <div
            role="group"
            aria-label={strings.match(a, b, scoreLine(match), winner, match.status === 'live')}
            style={card}
        >
            <Head match={match} />
            <div style={{ borderBottom: '1px solid var(--tw-border)' }}>
                <Line view={view} side="a" onPick={onPick} />
            </div>
            <Line view={view} side="b" onPick={onPick} />
            {view.missed && (
                <div style={missedLine}>
                    {strings.missed}{' '}
                    <span style={{ textDecoration: 'line-through' }}>{entryName(view.missed)}</span>
                </div>
            )}
        </div>
    )
}
