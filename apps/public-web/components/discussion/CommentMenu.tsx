'use client'

import { useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { DiscussionError } from '@/lib/discussion/api'
import { REPORT_REASONS, type ReportReason } from '@/lib/discussion/reasons'
import { wasReported } from '@/lib/discussion/reported'
import type { Comment } from '@/lib/discussion/types'

import { loginHref } from './format'
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

const toggle: React.CSSProperties = {
    ...linkButton,
    color: 'var(--tw-text-muted)',
    fontSize: 16,
    lineHeight: 1,
    marginLeft: 'auto',
}

const danger: React.CSSProperties = { ...linkButton, color: 'var(--tw-live)' }

const box: React.CSSProperties = {
    margin: '8px 0 0',
    padding: '8px 10px',
    borderRadius: 6,
    background: 'var(--tw-bg-alt)',
    fontSize: 13,
    flexBasis: '100%',
}

const row: React.CSSProperties = { margin: '6px 0 0', display: 'flex', gap: 12, flexWrap: 'wrap' }

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

    return (
        <>
            <button
                type="button"
                style={toggle}
                aria-label={strings.actions}
                aria-expanded={panel.kind !== 'closed'}
                onClick={() =>
                    setPanel(panel.kind === 'closed' ? { kind: 'menu' } : { kind: 'closed' })
                }
            >
                ···
            </button>

            {panel.kind === 'menu' && (
                <span style={{ display: 'flex', gap: 12 }}>
                    {own ? (
                        <button
                            type="button"
                            style={danger}
                            onClick={() => setPanel({ kind: 'remove', busy: false, failed: false })}
                        >
                            {strings.remove}
                        </button>
                    ) : (
                        <button
                            type="button"
                            style={linkButton}
                            disabled={reported}
                            onClick={openReport}
                        >
                            {reported ? strings.reported : strings.report}
                        </button>
                    )}
                </span>
            )}

            {panel.kind === 'remove' && (
                <div style={box}>
                    <p style={{ margin: 0 }}>
                        {strings.confirmRemove}
                        {comment.replyCount > 0 && ` ${strings.confirmRemoveReplies}`}
                    </p>
                    <p style={row}>
                        <button type="button" style={danger} disabled={panel.busy} onClick={remove}>
                            {panel.busy
                                ? strings.sending
                                : panel.failed
                                  ? strings.retry
                                  : strings.remove}
                        </button>
                        <button
                            type="button"
                            style={linkButton}
                            disabled={panel.busy}
                            onClick={() => setPanel({ kind: 'closed' })}
                        >
                            {strings.cancel}
                        </button>
                        {panel.failed && <span style={muted}>{strings.removeFailed}</span>}
                    </p>
                </div>
            )}

            {panel.kind === 'sign-in' && (
                <p style={{ ...box, ...muted }}>
                    {strings.signInToReport} ·{' '}
                    <a href={loginHref()} style={{ color: 'var(--tw-primary)' }}>
                        {strings.signIn}
                    </a>
                </p>
            )}

            {panel.kind === 'report' && (
                <div style={box}>
                    <p style={{ margin: 0 }}>{strings.reportReason}</p>
                    <p style={row}>
                        {REPORT_REASONS.map((reason) => (
                            <button
                                key={reason}
                                type="button"
                                style={{
                                    ...linkButton,
                                    fontWeight: panel.reason === reason ? 600 : 400,
                                }}
                                disabled={panel.busy}
                                onClick={() => report(reason)}
                            >
                                {strings.reasons[reason]}
                            </button>
                        ))}
                        <button
                            type="button"
                            style={{ ...linkButton, ...muted }}
                            disabled={panel.busy}
                            onClick={() => setPanel({ kind: 'closed' })}
                        >
                            {strings.cancel}
                        </button>
                    </p>
                    {panel.busy && <p style={{ ...muted, margin: '6px 0 0' }}>{strings.sending}</p>}
                    {panel.failure === 'network' && panel.reason && (
                        <p style={{ ...muted, margin: '6px 0 0' }}>
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
                        <p style={{ ...muted, margin: '6px 0 0' }}>{strings.tooManyReports}</p>
                    )}
                    {panel.failure === 'removed' && (
                        <p style={{ ...muted, margin: '6px 0 0' }}>{strings.alreadyRemoved}</p>
                    )}
                </div>
            )}

            {panel.kind === 'reported' && (
                <p style={{ ...box, ...muted }}>
                    {strings.reported} ·{' '}
                    <button
                        type="button"
                        style={linkButton}
                        onClick={() => setPanel({ kind: 'closed' })}
                    >
                        {strings.cancel}
                    </button>
                </p>
            )}
        </>
    )
}
