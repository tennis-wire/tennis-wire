'use client'

import { useMemo, useState } from 'react'

import { choose, project } from '@/lib/tennis/picks'
import { matchesOf, openingRound, roundName, shownRounds } from '@/lib/tennis/rounds'
import type { Knockout } from '@/lib/tennis/types'

import MatchCard, { asIs } from './MatchCard'
import { strings } from './strings'
import { chip, chips, label, segment, segments } from './styles'
import { usePicks } from './usePicks'

// Half the column gap of .tw-draw-cols in globals.css: a link runs from a card to the middle of the gap
const HALF_GAP = 12

const rule = '1px solid var(--tw-border)'

// From the middle of the card out to the gap, then down (the upper match of a pair) or up (the
// lower one) to where the pair meets. That point is the middle of the next round's slot, because
// a slot there is as tall as the two it is fed by.
const outgoing = (upper: boolean): React.CSSProperties => ({
    position: 'absolute',
    right: -HALF_GAP,
    width: HALF_GAP,
    top: upper ? '50%' : 0,
    height: '50%',
    borderRight: rule,
    ...(upper ? { borderTop: rule } : { borderBottom: rule }),
})

const incoming: React.CSSProperties = {
    position: 'absolute',
    left: -HALF_GAP,
    width: HALF_GAP,
    top: '50%',
    borderTop: rule,
}

const hint: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text-muted)',
    margin: '10px 0 0',
}

const reset: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--tw-primary)',
    cursor: 'pointer',
}

const slot: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    padding: '6px 0',
}

// Three rounds side by side from the chosen one, and on a phone only the chosen one. Every round
// is a column of equal slots: half as many matches, each slot twice as tall, so a match sits level
// with the middle of the two it comes from.
//
// With picksKey the reader can switch to his own draw and build it to the final, kept under that key.
export default function KnockoutBracket({
    stage,
    picksKey,
}: {
    stage: Knockout
    picksKey?: string
}) {
    const [chosen, setChosen] = useState(() => openingRound(stage))
    const [mine, setMine] = useState(false)
    const [picks, savePicks] = usePicks(picksKey ?? '')
    const own = mine && picksKey !== undefined
    const views = useMemo(() => (own ? project(stage, picks) : null), [own, stage, picks])
    const rounds = shownRounds(chosen, stage.rounds)

    return (
        <div>
            {picksKey !== undefined && (
                <div style={{ margin: '0 0 16px' }}>
                    <div style={segments} role="group" aria-label={strings.modesLabel}>
                        {([false, true] as const).map((option) => (
                            <button
                                key={String(option)}
                                type="button"
                                aria-pressed={option === mine}
                                style={segment(option === mine)}
                                onClick={() => setMine(option)}
                            >
                                {option ? strings.modes.mine : strings.modes.real}
                            </button>
                        ))}
                    </div>
                    {own && (
                        <p style={hint}>
                            {strings.picksHint}{' '}
                            {Object.keys(picks).length > 0 && (
                                <button type="button" style={reset} onClick={() => savePicks({})}>
                                    {strings.reset}
                                </button>
                            )}
                        </p>
                    )}
                </div>
            )}
            {stage.rounds > 1 && (
                <div style={chips} role="group" aria-label={strings.roundsLabel}>
                    {Array.from({ length: stage.rounds }, (_, i) => i + 1).map((round) => (
                        <button
                            key={round}
                            type="button"
                            aria-pressed={round === chosen}
                            style={chip(round === chosen)}
                            onClick={() => setChosen(round)}
                        >
                            {strings.roundShort(roundName(round, stage.rounds))}
                        </button>
                    ))}
                </div>
            )}
            <div
                className="tw-draw-cols"
                style={{ '--tw-draw-cols': rounds.length } as React.CSSProperties}
            >
                {rounds.map((round, column) => (
                    <section key={round} className="tw-draw-col">
                        <h3 style={{ ...label, marginBottom: 6 }}>
                            {strings.roundFull(roundName(round, stage.rounds))}
                        </h3>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {matchesOf(stage, round).map((match) => (
                                <div key={match.id} style={slot}>
                                    {column > 0 && (
                                        <span className="tw-draw-link" style={incoming} />
                                    )}
                                    <div style={{ width: '100%', minWidth: 0 }}>
                                        <MatchCard
                                            match={match}
                                            view={views?.get(match.id) ?? asIs(match)}
                                            onPick={
                                                own
                                                    ? (entryId) =>
                                                          savePicks(
                                                              choose(stage, picks, match, entryId)
                                                          )
                                                    : undefined
                                            }
                                        />
                                    </div>
                                    {column < rounds.length - 1 && (
                                        <span
                                            className="tw-draw-link"
                                            style={outgoing(match.number % 2 === 1)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    )
}
