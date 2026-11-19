import { entryName } from '@/lib/tennis/names'
import type { Groups } from '@/lib/tennis/types'

import MatchCard from './MatchCard'
import { strings } from './strings'
import { label } from './styles'

const cell: React.CSSProperties = {
    padding: '10px 0',
    borderBottom: '1px solid var(--tw-border)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    width: 64,
}

const headCell: React.CSSProperties = {
    ...cell,
    padding: '8px 0',
    fontSize: 13,
    fontWeight: 400,
    color: 'var(--tw-text-secondary)',
}

const bar = (on: boolean): React.CSSProperties => ({
    width: 3,
    height: 16,
    flexShrink: 0,
    borderRadius: 2,
    background: on ? 'var(--tw-primary)' : 'transparent',
})

// A table per group in the order the provider gives, then the group's matches. A bar marks who
// went through to the playoff, once the group is over.
export default function GroupStage({ stage }: { stage: Groups }) {
    return (
        <div className="tw-draw-groups">
            {stage.groups.map((group) => (
                <section key={group.id} style={{ minWidth: 0 }}>
                    <h3 style={label}>{group.name}</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    style={{ ...headCell, textAlign: 'left', width: 'auto' }}
                                >
                                    {strings.table.player}
                                </th>
                                <th scope="col" style={headCell}>
                                    {strings.table.matches}
                                </th>
                                <th scope="col" style={headCell}>
                                    {strings.table.sets}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {group.rows.map((row) => (
                                <tr key={row.entry.id}>
                                    <th
                                        scope="row"
                                        style={{
                                            ...cell,
                                            textAlign: 'left',
                                            width: 'auto',
                                            fontWeight: row.qualified ? 600 : 400,
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            <span
                                                style={bar(row.qualified)}
                                                {...(row.qualified
                                                    ? {
                                                          role: 'img',
                                                          'aria-label': strings.qualified,
                                                      }
                                                    : { 'aria-hidden': true })}
                                            />
                                            {entryName(row.entry)}
                                        </span>
                                    </th>
                                    <td style={cell}>
                                        {row.won}–{row.lost}
                                    </td>
                                    <td style={cell}>
                                        {row.setsWon}–{row.setsLost}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}
                    >
                        {group.matches.map((match) => (
                            <MatchCard key={match.id} match={match} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}
