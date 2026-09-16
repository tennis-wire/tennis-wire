'use client'

import { useId, useState } from 'react'

import { BLOCK_MODES, type BlockMode } from '@/lib/discussion/modes'

import { strings } from './strings'
import { linkButton, muted } from './styles'

type Props = {
    // what it opens on: soft for someone not ignored yet (§9.4), the current mode otherwise
    initial: BlockMode
    confirmLabel: string
    busy: boolean
    // why the last try did not go through
    failure: string | null
    onConfirm: (mode: BlockMode) => void
    onCancel: () => void
}

const option: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: '6px 0',
    fontSize: 14,
    color: 'var(--tw-text)',
}

const confirm: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '6px 14px',
    borderRadius: 7,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: '#fff',
    cursor: 'pointer',
}

const cancel: React.CSSProperties = {
    ...linkButton,
    fontSize: 14,
    color: 'var(--tw-text-secondary)',
}

// Chosen here, sent by whoever holds the picker: the comment menu for a new ignore, the cabinet
// for a change. The request and its outcome are theirs; this only keeps the choice.
export default function IgnoreModePicker({
    initial,
    confirmLabel,
    busy,
    failure,
    onConfirm,
    onCancel,
}: Props) {
    const [mode, setMode] = useState(initial)
    const group = useId()

    return (
        <div role="radiogroup" aria-label={strings.ignoreMode}>
            {BLOCK_MODES.map((value) => (
                <label key={value} style={{ ...option, cursor: busy ? 'default' : 'pointer' }}>
                    <input
                        type="radio"
                        name={group}
                        checked={mode === value}
                        disabled={busy}
                        onChange={() => setMode(value)}
                        style={{ margin: '3px 0 0', accentColor: 'var(--tw-primary)' }}
                    />
                    <span>
                        <span style={{ display: 'block' }}>{strings.modes[value]}</span>
                        <span style={{ ...muted, display: 'block', marginTop: 2 }}>
                            {strings.modeHints[value]}
                        </span>
                    </span>
                </label>
            ))}

            {mode === 'subtree_removal' && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--tw-live)' }}>
                    {strings.subtreeWarning}
                </p>
            )}

            <p style={{ margin: '12px 0 0', display: 'flex', gap: 14, alignItems: 'center' }}>
                <button
                    type="button"
                    style={confirm}
                    disabled={busy}
                    onClick={() => onConfirm(mode)}
                >
                    {busy ? strings.saving : confirmLabel}
                </button>
                <button type="button" style={cancel} disabled={busy} onClick={onCancel}>
                    {strings.cancel}
                </button>
            </p>

            {failure && (
                <p role="alert" style={{ ...muted, margin: '8px 0 0' }}>
                    {failure}
                </p>
            )}
        </div>
    )
}
