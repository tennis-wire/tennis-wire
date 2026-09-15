'use client'

import { useEffect, useRef, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { DiscussionError, NetworkError } from '@/lib/discussion/api'
import { MAX_LENGTH, MAX_LINKS, normalize, problem } from '@/lib/discussion/compose'
import { clearDraft, readDraft, saveDraft } from '@/lib/discussion/drafts'

import { formatUntil } from './format'
import { strings } from './strings'
import { linkButton, muted } from './styles'

type Props = {
    // null: nothing to key a draft by (the session carries no user id), so none is kept
    draftKey: string | null
    // text handed over from a reply whose parent is gone (§5.5); `at` tells one hand-over
    // from the next
    seed?: Seed | null
    placeholder: string
    autoFocus?: boolean
    // sends the normalized text; throws DiscussionError or NetworkError
    onSubmit: (body: string) => Promise<void>
    onCancel?: () => void
    // a reply form only: the parent is gone, the text can go up as a comment of its own
    onParentDeleted?: (text: string) => void
    onSessionExpired?: () => void
}

export type Seed = { text: string; at: number }

type Failure =
    { kind: 'network' } | { kind: 'rate' } | { kind: 'parent' } | { kind: 'other'; message: string }

const DRAFT_DELAY_MS = 300

const field: React.CSSProperties = {
    display: 'block',
    width: '100%',
    minHeight: 88,
    padding: 8,
    font: 'inherit',
    fontSize: 15,
    lineHeight: 1.5,
    color: 'var(--tw-text)',
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 6,
    resize: 'vertical',
    boxSizing: 'border-box',
}

const button: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: '#fff',
    cursor: 'pointer',
}

const plate: React.CSSProperties = {
    margin: '0 0 8px',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'color-mix(in srgb, var(--tw-accent-soft) 45%, transparent)',
    fontSize: 14,
}

function classify(error: unknown): Failure {
    if (error instanceof NetworkError) return { kind: 'network' }
    if (error instanceof DiscussionError) {
        if (error.status === 429) return { kind: 'rate' }
        if (error.code === 'PARENT_DELETED') return { kind: 'parent' }
        if (error.status >= 500 || error.code === 'GATEWAY_UNAVAILABLE') return { kind: 'network' }
        return { kind: 'other', message: error.message }
    }
    return { kind: 'network' }
}

export default function ComposeForm({
    draftKey,
    seed = null,
    placeholder,
    autoFocus = false,
    onSubmit,
    onCancel,
    onParentDeleted,
    onSessionExpired,
}: Props) {
    const { setSession } = useReaderSession()
    const [text, setText] = useState(() => (draftKey ? (readDraft(draftKey) ?? '') : ''))
    const [sending, setSending] = useState(false)
    const [failure, setFailure] = useState<Failure | null>(null)
    // undefined: no restriction met; null: one with no end (§12, §4.20)
    const [restrictedUntil, setRestrictedUntil] = useState<string | null | undefined>(undefined)
    const sent = useRef(false)
    const latest = useRef({ draftKey, text })
    // A hand-over replaces the text once; state adjusted during render, the way React wants
    // a prop change answered
    const [seedTaken, setSeedTaken] = useState<number | null>(null)
    if (seed && seed.at !== seedTaken) {
        setSeedTaken(seed.at)
        setText(seed.text)
    }

    // The draft follows the typing at a short distance, and the last of it goes when the form
    // does — the reply form closes on cancel, and the article page can be left mid-word.
    useEffect(() => {
        latest.current = { draftKey, text }
    })
    useEffect(() => {
        if (!draftKey) return
        const timer = setTimeout(() => saveDraft(draftKey, text), DRAFT_DELAY_MS)
        return () => clearTimeout(timer)
    }, [draftKey, text])
    useEffect(
        () => () => {
            const { draftKey: key, text: left } = latest.current
            if (key && !sent.current) saveDraft(key, left)
        },
        []
    )

    const issue = problem(text)
    const length = normalize(text).length

    async function submit() {
        if (issue || sending) return
        setSending(true)
        setFailure(null)
        try {
            await onSubmit(normalize(text))
            sent.current = true
            if (draftKey) clearDraft(draftKey)
            setText('')
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) {
                // the proxy has already dropped the cookie; the text stays in the draft under
                // this reader's id and comes back after the next sign-in (§4.19)
                onSessionExpired?.()
                setSession({ authenticated: false })
                return
            }
            if (error instanceof DiscussionError && error.code === 'COMMENTING_RESTRICTED') {
                setRestrictedUntil(
                    (error.details.restrictedUntil as string | null | undefined) ?? null
                )
                return
            }
            setFailure(classify(error))
        } finally {
            setSending(false)
        }
    }

    if (restrictedUntil !== undefined) {
        return (
            <div>
                <p style={plate}>
                    {restrictedUntil
                        ? strings.restrictedUntil(formatUntil(restrictedUntil))
                        : strings.restrictedIndefinitely}
                </p>
                {text !== '' && (
                    <textarea readOnly value={text} style={field} aria-label={placeholder} />
                )}
            </div>
        )
    }

    return (
        <div>
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                autoFocus={autoFocus}
                disabled={sending}
                maxLength={MAX_LENGTH * 2}
                style={field}
            />
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    marginTop: 6,
                    flexWrap: 'wrap',
                }}
            >
                <button
                    type="button"
                    style={button}
                    disabled={sending || issue !== null}
                    onClick={submit}
                >
                    {sending ? strings.sending : strings.send}
                </button>
                {onCancel && (
                    <button type="button" style={linkButton} disabled={sending} onClick={onCancel}>
                        {strings.cancel}
                    </button>
                )}
                <span
                    style={{ ...muted, color: issue === 'long' ? 'var(--tw-live)' : muted.color }}
                >
                    {strings.counter(length, MAX_LENGTH)}
                </span>
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
            </div>
            {failure && (
                <p style={{ ...muted, margin: '8px 0 0' }}>
                    {failure.kind === 'network' && (
                        <>
                            {strings.sendFailed}{' '}
                            <button type="button" style={linkButton} onClick={submit}>
                                {strings.retry}
                            </button>
                        </>
                    )}
                    {failure.kind === 'rate' && strings.tooOften}
                    {failure.kind === 'parent' && (
                        <>
                            {strings.parentDeleted}{' '}
                            {onParentDeleted && (
                                <button
                                    type="button"
                                    style={linkButton}
                                    onClick={() => {
                                        // the text moves to the other form, draft and all
                                        sent.current = true
                                        if (draftKey) clearDraft(draftKey)
                                        onParentDeleted(text)
                                    }}
                                >
                                    {strings.postAsNew}
                                </button>
                            )}
                        </>
                    )}
                    {failure.kind === 'other' && failure.message}
                </p>
            )}
        </div>
    )
}
