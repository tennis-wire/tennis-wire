import { useState } from 'react'
import { Alert, Box, Button, Collapse } from '@mui/material'

import { collectorSilentSince, problemsOf } from '../lib/health'
import { clockOf } from '../lib/when'
import type { Source } from '../types/aggregator'

function sourcesWord(count: number): string {
    const tens = count % 100
    const ones = count % 10
    if (tens >= 11 && tens <= 14) return 'источников'
    if (ones === 1) return 'источник'
    if (ones >= 2 && ones <= 4) return 'источника'
    return 'источников'
}

// Said only when something is wrong. A silent collector says it for every source at once, so it
// takes the place of the per-source list, which is stale then anyway
export default function HealthNotice({ sources, now }: { sources: Source[]; now: Date }) {
    const [open, setOpen] = useState(false)
    const silent = collectorSilentSince(sources, now)

    if (silent !== null) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                Сбор новостей не работает с {clockOf(silent.toISOString())}: новые новости не
                приходят ни от одного источника.
            </Alert>
        )
    }

    const problems = problemsOf(sources)
    if (problems.length === 0) return null
    const count = new Set(problems.map((problem) => problem.source)).size
    return (
        <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
                <Button color="inherit" size="small" onClick={() => setOpen(!open)}>
                    {open ? 'Скрыть' : 'Подробнее'}
                </Button>
            }
        >
            {count} {sourcesWord(count)} {count === 1 ? 'работает' : 'работают'} с перебоями:
            новостей от {count === 1 ? 'него' : 'них'} может не хватать.
            <Collapse in={open}>
                <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                    {problems.map((problem) => (
                        <li key={`${problem.source}:${problem.text}`}>
                            <strong>{problem.source}</strong> — {problem.text}
                        </li>
                    ))}
                </Box>
            </Collapse>
        </Alert>
    )
}
