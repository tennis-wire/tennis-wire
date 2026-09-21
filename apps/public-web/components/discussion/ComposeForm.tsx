'use client'

import { useEffect, useRef, useState } from 'react'

import Avatar from '@/components/Avatar'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { DiscussionError } from '@/lib/discussion/api'
import {
    type Failure,
    type Keyed,
    MAX_LENGTH,
    MAX_LINKS,
    classify,
    keyFor,
    normalize,
    problem,
} from '@/lib/discussion/compose'
import { clearDraft, readDraft, saveDraft } from '@/lib/discussion/drafts'

import RestrictionPlate from './RestrictionPlate'
import { strings } from './strings'
import { action, linkButton, muted } from './styles'

type Props = {
    // null: nothing to key a draft by (the session carries no user id), so none is kept
    draftKey: string | null
    // text handed over from a reply whose parent is gone; `at` tells one hand-over
    // from the next
    seed?: Seed | null
    placeholder: string
    autoFocus?: boolean
    // sends the normalized text under its idempotency key; throws DiscussionError or NetworkError
    onSubmit: (body: string, idempotencyKey: string) => Promise<void>
    onCancel?: () => void
    // a reply form only: the parent is gone, the text can go up as a comment of its own
    onParentDeleted?: (text: string) => void
    onSessionExpired?: () => void
}

export type Seed = { text: string; at: number }

const DRAFT_DELAY_MS = 300

// The box is the form; the field inside it carries no border of its own, so what the reader sees
// is one place to write rather than a control sitting on the page.
const box: React.CSSProperties = {
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
    background: 'var(--tw-surface)',
    padding: '10px 12px',
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

// The same rail a comment stands on, so what the reader is about to write lines up with what he
// is writing under
const row: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
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
    padding: '8px 20px',
    borderRadius: 20,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: '#fff',
    cursor: 'pointer',
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
    const { session, setSession } = useReaderSession()
    const [text, setText] = useState(() => (draftKey ? (readDraft(draftKey) ?? '') : ''))
    const [sending, setSending] = useState(false)
    const [failure, setFailure] = useState<Failure | null>(null)
    // undefined: no restriction met; null: one with no end
    const [restrictedUntil, setRestrictedUntil] = useState<string | null | undefined>(undefined)
    const sent = useRef(false)
    // the text last sent and the key it went under, until an answer says the comment is written
    const pending = useRef<Keyed | null>(null)
    const latest = useRef({ draftKey, text })
    // A hand-over replaces the text once; state adjusted during render, the way React wants
    // a prop change answered
    const [seedTaken, setSeedTaken] = useState<number | null>(null)
    if (seed && seed.at !== seedTaken) {
        setSeedTaken(seed.at)
        setText(seed.text)
    }

    // The draft follows the typing at a short distance, and the last of it goes when the form
    // does: the reply form closes on cancel, and the article page can be left mid-word.
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
            const send = keyFor(pending.current, normalize(text))
            pending.current = send
            await onSubmit(send.body, send.key)
            pending.current = null
            sent.current = true
            if (draftKey) clearDraft(draftKey)
            setText('')
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) {
                // the proxy has already dropped the cookie; the text stays in the draft under
                // this reader's id and comes back after the next sign-in
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
            setFailure(classify(error, onParentDeleted !== undefined))
        } finally {
            setSending(false)
        }
    }

    const mine = session?.authenticated ? session.displayName : null
    const face = session?.authenticated ? session.avatarUrl : null

    if (restrictedUntil !== undefined) {
        return (
            <RestrictionPlate until={restrictedUntil}>
                {text !== '' && (
                    <div style={box}>
                        <textarea readOnly value={text} style={field} aria-label={placeholder} />
                    </div>
                )}
            </RestrictionPlate>
        )
    }

    return (
        <div style={row}>
            <Avatar name={mine} src={face} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={box}>
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
                        {/* The count is only worth the reader's attention as the limit comes up */}
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
                            {onCancel && (
                                <button
                                    type="button"
                                    style={action}
                                    disabled={sending}
                                    onClick={onCancel}
                                >
                                    {strings.cancel}
                                </button>
                            )}
                            <button
                                type="button"
                                style={button}
                                disabled={sending || issue !== null}
                                onClick={submit}
                            >
                                {sending ? strings.sending : strings.send}
                            </button>
                        </span>
                    </div>
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
        </div>
    )
}
