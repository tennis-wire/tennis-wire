'use client'

import { useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { DiscussionError } from '@/lib/discussion/api'
import { MAX_LENGTH, MAX_LINKS, normalize, problem } from '@/lib/discussion/compose'
import { type EditFailure, editFailure } from '@/lib/discussion/edit'

import { strings } from './strings'
import { action, linkButton, muted } from './styles'

type Props = {
    // the text as it stands now
    body: string
    // sends the normalized text; throws DiscussionError or NetworkError
    onSave: (body: string) => Promise<void>
    onCancel: () => void
    onSessionExpired: () => void
}

// No draft is kept: the text is already published, and what the reader is changing it to lives
// only as long as the form. Sits where the comment was, so the box is the same one ComposeForm uses.
const box: React.CSSProperties = {
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
    background: 'var(--tw-surface)',
    padding: '10px 12px',
    marginTop: 6,
}

const field: React.CSSProperties = {
    display: 'block',
    width: '100%',
    minHeight: 64,
    padding: 0,
    font: 'inherit',
    fontSize: 15,
    lineHeight: 1.5,
    color: 'var(--tw-text)',
    background: 'transparent',
    border: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
}

const footer: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--tw-border)',
    flexWrap: 'wrap',
}

const button: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    padding: '6px 16px',
    borderRadius: 20,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: 'var(--tw-on-primary)',
    cursor: 'pointer',
}

function message(failure: EditFailure): string {
    switch (failure.kind) {
        case 'rate':
            return strings.tooOften
        case 'late':
            return strings.editTooLate
        case 'deleted':
            return strings.editGone
        case 'removed':
            return strings.editRemoved
        case 'other':
            return failure.message
        case 'network':
            return strings.editFailed
    }
}

export default function EditForm({ body, onSave, onCancel, onSessionExpired }: Props) {
    const { setSession } = useReaderSession()
    const [text, setText] = useState(body)
    const [saving, setSaving] = useState(false)
    const [failure, setFailure] = useState<EditFailure | null>(null)

    const issue = problem(text)
    const length = normalize(text).length
    // The same text is no edit, and the service writes nothing for it; closing the form says as much
    const unchanged = normalize(text) === normalize(body)

    async function save() {
        if (issue || saving) return
        if (unchanged) return onCancel()
        setSaving(true)
        setFailure(null)
        try {
            await onSave(normalize(text))
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) {
                onSessionExpired()
                setSession({ authenticated: false })
                return
            }
            setFailure(editFailure(error))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <div style={box}>
                <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    aria-label={strings.edit}
                    autoFocus
                    disabled={saving}
                    maxLength={MAX_LENGTH * 2}
                    style={field}
                />
                <div style={footer}>
                    {issue === 'long' && (
                        <span style={{ fontSize: 13, color: 'var(--tw-live)' }}>
                            {strings.tooLong(MAX_LENGTH)}
                        </span>
                    )}
                    {issue === 'links' && (
                        <span style={{ fontSize: 13, color: 'var(--tw-live)' }}>
                            {strings.tooManyLinks(MAX_LINKS)}
                        </span>
                    )}
                    {length > MAX_LENGTH - 200 && (
                        <span
                            style={{
                                ...muted,
                                color: issue === 'long' ? 'var(--tw-live)' : muted.color,
                            }}
                        >
                            {strings.counter(length, MAX_LENGTH)}
                        </span>
                    )}
                    <span
                        style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                        }}
                    >
                        <button type="button" style={action} disabled={saving} onClick={onCancel}>
                            {strings.cancel}
                        </button>
                        <button
                            type="button"
                            style={button}
                            disabled={saving || issue !== null}
                            onClick={save}
                        >
                            {saving ? strings.sending : strings.saveEdit}
                        </button>
                    </span>
                </div>
            </div>
            {failure && (
                <p style={{ ...muted, margin: '8px 0 0' }}>
                    {message(failure)}
                    {failure.kind === 'network' && (
                        <>
                            {' '}
                            <button type="button" style={linkButton} onClick={save}>
                                {strings.retry}
                            </button>
                        </>
                    )}
                </p>
            )}
        </div>
    )
}
