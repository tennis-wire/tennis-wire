'use client'

import { useMemo, useState } from 'react'

import { SCENARIOS } from '@/lib/tennis/fixtures'

import DrawView from './DrawView'
import { chip, chips } from './styles'

// The dev page's switch between made-up tournaments. Generated in the browser: the draws are only
// ever looked at here.
export default function DevDraws({ initial }: { initial?: string }) {
    const [chosen, setChosen] = useState(initial ?? SCENARIOS[0].id)
    const scenario = SCENARIOS.find((s) => s.id === chosen) ?? SCENARIOS[0]
    const draws = useMemo(() => scenario.draws(), [scenario])

    return (
        <div>
            <div style={chips} role="group" aria-label="Пример">
                {SCENARIOS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        aria-pressed={s.id === scenario.id}
                        style={chip(s.id === scenario.id)}
                        onClick={() => setChosen(s.id)}
                    >
                        {s.title}
                    </button>
                ))}
            </div>
            <DrawView key={scenario.id} draws={draws} picksKey={`dev:${scenario.id}`} />
        </div>
    )
}
