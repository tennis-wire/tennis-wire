'use client'

import { useEffect, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { loginHere } from '@/lib/auth/loginHref'
import { DiscussionError } from '@/lib/discussion/api'
import { REPORT_REASONS, type ReportReason } from '@/lib/discussion/reasons'
import { wasReported } from '@/lib/discussion/reported'
import type { Comment } from '@/lib/discussion/types'

import { strings } from './strings'
import { linkButton, muted } from './styles'

type Props = {
    comment: Comment
    // the reader wrote it: the menu offers to take it down (§8), and nothing to report (§10.2)
    own: boolean
    signedIn: boolean
    onRemove: () => Promise<void>
    onReport: (reason: ReportReason) => Promise<void>
    onSessionExpired: () => void
}

type ReportFailure = 'network' | 'rate' | 'removed'

type Panel =
    | { kind: 'closed' }
    | { kind: 'menu' }
    | { kind: 'remove'; busy: boolean; failed: boolean }
    | { kind: 'sign-in' }
    | { kind: 'report'; reason: ReportReason | null; busy: boolean; failure: ReportFailure | null }
    | { kind: 'reported' }

// The panel hangs off the dots instead of standing in the byline: opened in the flow it pushed
// the name and the date aside and moved the comment under it.
const anchor: React.CSSProperties = {
    position: 'relative',
    marginLeft: 'auto',
    display: 'inline-flex',
}

const toggle: React.CSSProperties = {
    ...linkButton,
    color: 'var(--tw-text-muted)',
    fontSize: 16,
    lineHeight: 1,
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 10 }

const popover: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    padding: 6,
    minWidth: 230,
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
    boxShadow: 'var(--tw-card-shadow)',
    fontSize: 14,
    textAlign: 'left',
    zIndex: 20,
}

const item: React.CSSProperties = {
    ...linkButton,
    display: 'block',
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    fontSize: 14,
    color: 'var(--tw-text)',
    textAlign: 'left',
}

const danger: React.CSSProperties = { ...item, color: 'var(--tw-live)' }

const note: React.CSSProperties = { margin: 0, padding: '8px 10px', fontSize: 13 }

const row: React.CSSProperties = { margin: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }

// the reason a retry re-sends; the panel only offers one once a reason was picked
function chosen(panel: Extract<Panel, { kind: 'report' }>): ReportReason {
    return panel.reason ?? 'other'
}

export default function CommentMenu({
    comment,
    own,
    signedIn,
    onRemove,
    onReport,
    onSessionExpired,
}: Props) {
    const { setSession } = useReaderSession()
    const [panel, setPanel] = useState<Panel>({ kind: 'closed' })
    // what this device already sent (§10.7); the menu is client-only, so the read is safe here
    const [reported, setReported] = useState(() => wasReported(comment.id))

    function signedOut() {
        onSessionExpired()
        setSession({ authenticated: false })
        setPanel({ kind: 'closed' })
    }

    async function remove() {
        setPanel({ kind: 'remove', busy: true, failed: false })
        try {
            await onRemove()
            // the node this menu sat on is a placeholder or gone by now
            setPanel({ kind: 'closed' })
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            // a 403 cannot happen from here, the item is only offered on the reader's own; the
            // rest is the network, and a retry is the reader's
            setPanel({ kind: 'remove', busy: false, failed: true })
        }
    }

    async function report(reason: ReportReason) {
        setPanel({ kind: 'report', reason, busy: true, failure: null })
        try {
            await onReport(reason)
            setReported(true)
            setPanel({ kind: 'reported' })
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            const failure: ReportFailure =
                error instanceof DiscussionError && error.status === 429
                    ? 'rate'
                    : error instanceof DiscussionError && error.code === 'COMMENT_ALREADY_REMOVED'
                      ? 'removed'
                      : 'network'
            setPanel({ kind: 'report', reason, busy: false, failure })
        }
    }

    function openReport() {
        if (!signedIn) return setPanel({ kind: 'sign-in' })
        setPanel({ kind: 'report', reason: null, busy: false, failure: null })
    }

    useEffect(() => {
        if (panel.kind === 'closed') return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPanel({ kind: 'closed' })
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [panel.kind])

    return (
        <span style={anchor}>
            <button
                type="button"
                style={toggle}
                aria-label={strings.actions}
                aria-haspopup="menu"
                aria-expanded={panel.kind !== 'closed'}
                onClick={() =>
                    setPanel(panel.kind === 'closed' ? { kind: 'menu' } : { kind: 'closed' })
                }
            >
                ···
            </button>

            {panel.kind !== 'closed' && (
                <>
                    <span style={overlay} onClick={() => setPanel({ kind: 'closed' })} />
                    <div role="menu" style={popover}>
                        {panel.kind === 'menu' &&
                            (own ? (
                                <button
                                    type="button"
                                    role="menuitem"
                                    style={danger}
                                    onClick={() =>
                                        setPanel({ kind: 'remove', busy: false, failed: false })
                                    }
                                >
                                    {strings.remove}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    role="menuitem"
                                    style={item}
                                    disabled={reported}
                                    onClick={openReport}
                                >
                                    {reported ? strings.reported : strings.report}
                                </button>
                            ))}

                        {panel.kind === 'remove' && (
                            <>
                                <p style={note}>
                                    {strings.confirmRemove}
                                    {comment.replyCount > 0 && ` ${strings.confirmRemoveReplies}`}
                                </p>
                                <p style={row}>
                                    <button
                                        type="button"
                                        style={danger}
                                        disabled={panel.busy}
                                        onClick={remove}
                                    >
                                        {panel.busy
                                            ? strings.sending
                                            : panel.failed
                                              ? strings.retry
                                              : strings.remove}
                                    </button>
                                    <button
                                        type="button"
                                        style={item}
                                        disabled={panel.busy}
                                        onClick={() => setPanel({ kind: 'closed' })}
                                    >
                                        {strings.cancel}
                                    </button>
                                </p>
                                {panel.failed && (
                                    <p style={{ ...note, ...muted }}>{strings.removeFailed}</p>
                                )}
                            </>
                        )}

                        {panel.kind === 'sign-in' && (
                            <p style={{ ...note, ...muted }}>
                                {strings.signInToReport} ·{' '}
                                <a href={loginHere()} style={{ color: 'var(--tw-primary)' }}>
                                    {strings.signIn}
                                </a>
                            </p>
                        )}

                        {panel.kind === 'report' && (
                            <>
                                <p style={{ ...note, ...muted }}>{strings.reportReason}</p>
                                {REPORT_REASONS.map((reason) => (
                                    <button
                                        key={reason}
                                        type="button"
                                        role="menuitem"
                                        style={{
                                            ...item,
                                            fontWeight: panel.reason === reason ? 600 : 400,
                                        }}
                                        disabled={panel.busy}
                                        onClick={() => report(reason)}
                                    >
                                        {strings.reasons[reason]}
                                    </button>
                                ))}
                                {panel.busy && (
                                    <p style={{ ...note, ...muted }}>{strings.sending}</p>
                                )}
                                {panel.failure === 'network' && panel.reason && (
                                    <p style={{ ...note, ...muted }}>
                                        {strings.reportFailed}{' '}
                                        <button
                                            type="button"
                                            style={linkButton}
                                            onClick={() => report(chosen(panel))}
                                        >
                                            {strings.retry}
                                        </button>
                                    </p>
                                )}
                                {panel.failure === 'rate' && (
                                    <p style={{ ...note, ...muted }}>{strings.tooManyReports}</p>
                                )}
                                {panel.failure === 'removed' && (
                                    <p style={{ ...note, ...muted }}>{strings.alreadyRemoved}</p>
                                )}
                            </>
                        )}

                        {panel.kind === 'reported' && (
                            <p style={{ ...note, ...muted }}>{strings.reported}</p>
                        )}
                    </div>
                </>
            )}
        </span>
    )
}
