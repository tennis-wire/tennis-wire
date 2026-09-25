'use client'

import { useCallback, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { popoverPanel, usePopover } from '@/components/ui/popover'
import { loginHere } from '@/lib/auth/loginHref'
import { DiscussionError } from '@/lib/discussion/api'
import type { BlockMode } from '@/lib/discussion/modes'
import { REPORT_REASONS, type ReportReason } from '@/lib/discussion/reasons'
import { wasReported } from '@/lib/discussion/reported'
import type { Author, Comment } from '@/lib/discussion/types'

import IgnoreModePicker from './IgnoreModePicker'
import { strings } from './strings'
import { linkButton, muted } from './styles'

type Props = {
    comment: Comment
    // the reader wrote it: the menu offers to take it down, and nothing to report
    own: boolean
    signedIn: boolean
    // missing when the edit window has run out: then there is no item
    onEdit?: () => void
    onRemove: () => Promise<void>
    onReport: (reason: ReportReason) => Promise<void>
    // a new ignore of the author, or a change of mode; and lifting it. Both throw to be explained
    onIgnore: (authorId: string, mode: BlockMode) => Promise<void>
    onUnignore: (authorId: string) => Promise<void>
    onSessionExpired: () => void
}

type ReportFailure = 'network' | 'rate' | 'removed'

type Panel =
    | { kind: 'closed' }
    | { kind: 'menu' }
    | { kind: 'remove'; busy: boolean; failed: boolean }
    | { kind: 'sign-in'; to: 'report' | 'ignore' }
    | { kind: 'report'; reason: ReportReason | null; busy: boolean; failure: ReportFailure | null }
    | { kind: 'reported' }
    | { kind: 'ignore'; busy: boolean; failure: string | null }

// The panel hangs off the dots instead of standing in the byline: opened in the flow it pushed
// the name and the date aside and moved the comment under it.
const anchor: React.CSSProperties = {
    position: 'relative',
    marginLeft: 'auto',
    display: 'inline-flex',
}

const toggleStyle: React.CSSProperties = {
    ...linkButton,
    color: 'var(--tw-text-muted)',
    fontSize: 16,
    lineHeight: 1,
}

const popover: React.CSSProperties = {
    ...popoverPanel,
    right: 0,
    minWidth: 230,
    fontSize: 14,
    textAlign: 'left',
}

// No background: the class gives one under the pointer, and an inline one would win over it
const item: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    color: 'var(--tw-text)',
    textAlign: 'left',
    cursor: 'pointer',
}

const danger: React.CSSProperties = { ...item, color: 'var(--tw-live)' }

const note: React.CSSProperties = { margin: 0, padding: '8px 10px', fontSize: 13 }

const row: React.CSSProperties = { margin: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }

// the reason a retry re-sends; the panel only offers one once a reason was picked
function chosen(panel: Extract<Panel, { kind: 'report' }>): ReportReason {
    return panel.reason ?? 'other'
}

// A restricted author has no name to put in the title
function nameOf(author: Author): string | null {
    return 'restricted' in author ? null : author.displayName
}

function ignoreFailure(error: unknown, failed: string): string {
    if (error instanceof DiscussionError && error.status === 429) return strings.tooOften
    if (error instanceof DiscussionError && error.code === 'BLOCK_LIST_FULL')
        return strings.ignoreListFull
    return failed
}

export default function CommentMenu({
    comment,
    own,
    signedIn,
    onEdit,
    onRemove,
    onReport,
    onIgnore,
    onUnignore,
    onSessionExpired,
}: Props) {
    const { setSession } = useReaderSession()
    const [panel, setPanel] = useState<Panel>({ kind: 'closed' })
    // what this device already sent; the menu is client-only, so the read is safe here
    const [reported, setReported] = useState(() => wasReported(comment.id))
    const { author } = comment
    // the menu is only drawn on a comment the reader can read, so a soft_hidden one here is one he
    // collapsed by his ignore and opened again
    const ignoring = comment.visibility === 'soft_hidden'

    // The panel shuts and the keyboard goes back to the dots it hangs off, instead of falling to
    // the top of the document. Where the comment changes under the reader — a removal, a new
    // ignore — the menu goes with it and there is no longer anything here to stand on.
    const dismiss = useCallback(() => setPanel({ kind: 'closed' }), [])
    const { root, trigger, panelId } = usePopover<HTMLSpanElement>(panel.kind !== 'closed', dismiss)
    const close = useCallback(() => {
        dismiss()
        trigger.current?.focus()
    }, [dismiss, trigger])

    function signedOut() {
        onSessionExpired()
        setSession({ authenticated: false })
        close()
    }

    async function remove() {
        setPanel({ kind: 'remove', busy: true, failed: false })
        try {
            await onRemove()
            // the node this menu sat on is a placeholder or gone by now
            close()
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
        if (!signedIn) return setPanel({ kind: 'sign-in', to: 'report' })
        setPanel({ kind: 'report', reason: null, busy: false, failure: null })
    }

    function openIgnore() {
        if (!signedIn) return setPanel({ kind: 'sign-in', to: 'ignore' })
        setPanel({ kind: 'ignore', busy: false, failure: null })
    }

    async function ignore(authorId: string, mode: BlockMode) {
        // collapsed already, and asked to stay that way
        if (ignoring && mode === 'soft') return close()
        setPanel({ kind: 'ignore', busy: true, failure: null })
        try {
            // on success the comment collapses, hides or goes, and this menu with it
            await onIgnore(authorId, mode)
            close()
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            const failed = ignoring ? strings.saveFailed : strings.ignoreFailed
            setPanel({ kind: 'ignore', busy: false, failure: ignoreFailure(error, failed) })
        }
    }

    async function unignore(authorId: string) {
        setPanel({ kind: 'ignore', busy: true, failure: null })
        try {
            await onUnignore(authorId)
            close()
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            const failure = ignoreFailure(error, strings.unignoreFailed)
            setPanel({ kind: 'ignore', busy: false, failure })
        }
    }

    return (
        <span ref={root} style={anchor}>
            <button
                ref={trigger}
                type="button"
                style={toggleStyle}
                aria-label={strings.actions}
                aria-expanded={panel.kind !== 'closed'}
                aria-controls={panelId}
                onClick={() =>
                    setPanel(panel.kind === 'closed' ? { kind: 'menu' } : { kind: 'closed' })
                }
            >
                ···
            </button>

            {panel.kind !== 'closed' && (
                <div
                    id={panelId}
                    style={panel.kind === 'ignore' ? { ...popover, minWidth: 290 } : popover}
                >
                    {panel.kind === 'menu' &&
                        (own ? (
                            <>
                                {onEdit && (
                                    <button
                                        type="button"
                                        className="tw-menu-item"
                                        style={item}
                                        onClick={() => {
                                            setPanel({ kind: 'closed' })
                                            onEdit()
                                        }}
                                    >
                                        {strings.edit}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="tw-menu-item"
                                    style={danger}
                                    onClick={() =>
                                        setPanel({ kind: 'remove', busy: false, failed: false })
                                    }
                                >
                                    {strings.remove}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="tw-menu-item"
                                    style={item}
                                    disabled={reported}
                                    onClick={openReport}
                                >
                                    {reported ? strings.reported : strings.report}
                                </button>
                                {/* no author, no id to ignore by: user-service had no profile */}
                                {author && (
                                    <button
                                        type="button"
                                        className="tw-menu-item"
                                        style={item}
                                        onClick={openIgnore}
                                    >
                                        {ignoring
                                            ? strings.ignoredAs(strings.modes.soft)
                                            : strings.ignore}
                                    </button>
                                )}
                            </>
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
                                    className="tw-menu-item"
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
                                    className="tw-menu-item"
                                    style={item}
                                    disabled={panel.busy}
                                    onClick={close}
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
                            {panel.to === 'report'
                                ? strings.signInToReport
                                : strings.signInToIgnore}{' '}
                            ·{' '}
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
                                    className="tw-menu-item"
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
                            {panel.busy && <p style={{ ...note, ...muted }}>{strings.sending}</p>}
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
                        <>
                            <p style={{ ...note, ...muted }}>{strings.reported}</p>
                            {/* not offered on a comment the reader already collapsed: he ignores
                                    that author as it is */}
                            {author && !ignoring && (
                                <button
                                    type="button"
                                    className="tw-menu-item"
                                    style={item}
                                    onClick={openIgnore}
                                >
                                    {strings.ignoreAuthor}
                                </button>
                            )}
                        </>
                    )}

                    {panel.kind === 'ignore' && author && (
                        <div style={{ padding: '4px 10px 8px' }}>
                            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>
                                {ignoring
                                    ? strings.ignoringWhom(nameOf(author))
                                    : strings.ignoreWhom(nameOf(author))}
                            </p>
                            <IgnoreModePicker
                                initial="soft"
                                confirmLabel={ignoring ? strings.save : strings.ignore}
                                busy={panel.busy}
                                failure={panel.failure}
                                onConfirm={(mode) => ignore(author.id, mode)}
                                onCancel={close}
                            />
                            {ignoring && (
                                <p style={{ margin: '10px 0 0' }}>
                                    <button
                                        type="button"
                                        style={linkButton}
                                        disabled={panel.busy}
                                        onClick={() => unignore(author.id)}
                                    >
                                        {strings.unignore}
                                    </button>
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </span>
    )
}
