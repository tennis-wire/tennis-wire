'use client'

import { useState } from 'react'

import type { Draw, DrawKind } from '@/lib/tennis/types'

import GroupStage from './GroupStage'
import KnockoutBracket from './KnockoutBracket'
import { strings } from './strings'
import { segment, segments } from './styles'

const sex = (kind: DrawKind) => (kind === 'xd' ? 'x' : kind[0])

// "Мужчины" and "Женщины" only where both play; a tour event has "Одиночный" and "Парный"
function drawLabel(draw: Draw, both: boolean): string {
    const base = both
        ? strings.draws[draw.kind]
        : draw.kind.endsWith('s')
          ? strings.singles
          : strings.doubles
    return draw.qualifying ? `${base} · ${strings.qualifying}` : base
}

const stageHead: React.CSSProperties = { fontSize: 20, margin: '0 0 14px' }

// The draws of one tournament year, one at a time. picksKey lets the reader build his own draw on
// top of a knockout one; the draw's id is added to it. Not on round robins: picking them is
// another game.
export default function DrawView({ draws, picksKey }: { draws: Draw[]; picksKey?: string }) {
    const [chosen, setChosen] = useState(draws[0]?.id)
    const draw = draws.find((d) => d.id === chosen) ?? draws[0]
    if (!draw) return null
    const both = new Set(draws.map((d) => sex(d.kind))).size > 1

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {draws.length > 1 && (
                <div>
                    <div style={segments} role="group" aria-label={strings.drawsLabel}>
                        {draws.map((d) => (
                            <button
                                key={d.id}
                                type="button"
                                aria-pressed={d.id === draw.id}
                                style={segment(d.id === draw.id)}
                                onClick={() => setChosen(d.id)}
                            >
                                {drawLabel(d, both)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {draw.stages.map((stage, i) => (
                <section key={`${draw.id}-${i}`}>
                    {draw.stages.length > 1 && (
                        <h2 style={stageHead}>
                            {stage.kind === 'groups' ? strings.groupStage : strings.playoff}
                        </h2>
                    )}
                    {stage.kind === 'knockout' ? (
                        <KnockoutBracket
                            stage={stage}
                            picksKey={
                                picksKey !== undefined && draw.stages.length === 1
                                    ? `${picksKey}:${draw.id}`
                                    : undefined
                            }
                        />
                    ) : (
                        <GroupStage stage={stage} />
                    )}
                </section>
            ))}
        </div>
    )
}
