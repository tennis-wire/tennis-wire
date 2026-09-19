'use client'

import { SORTS } from '@/lib/discussion/sort'
import type { Sort } from '@/lib/discussion/types'

import { strings } from './strings'

type Props = {
    sort: Sort
    onChange: (sort: Sort) => void
}

const row: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    margin: '0 0 16px',
}

const chip = (chosen: boolean): React.CSSProperties => ({
    font: 'inherit',
    fontSize: 13,
    padding: '4px 12px',
    borderRadius: 14,
    border: `1px solid ${chosen ? 'var(--tw-primary)' : 'var(--tw-border)'}`,
    background: chosen ? 'color-mix(in srgb, var(--tw-primary) 12%, transparent)' : 'transparent',
    color: chosen ? 'var(--tw-primary)' : 'var(--tw-text)',
    cursor: chosen ? 'default' : 'pointer',
})

export default function SortPicker({ sort, onChange }: Props) {
    return (
        <div style={row} role="group" aria-label={strings.sortLabel}>
            {SORTS.map((option) => (
                <button
                    key={option}
                    type="button"
                    aria-pressed={option === sort}
                    style={chip(option === sort)}
                    onClick={() => onChange(option)}
                >
                    {strings.sorts[option]}
                </button>
            ))}
        </div>
    )
}
