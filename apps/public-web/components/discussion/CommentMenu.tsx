'use client'

import { useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { DiscussionError } from '@/lib/discussion/api'
import type { Comment } from '@/lib/discussion/types'

import { strings } from './strings'
import { linkButton, muted } from './styles'

type Props = {
    comment: Comment
    // the reader wrote it: the menu offers to take it down (§8)
    own: boolean
    onRemove: () => Promise<void>
    onSessionExpired: () => void
}

type Panel =
    { kind: 'closed' } | { kind: 'menu' } | { kind: 'remove'; busy: boolean; failed: boolean }

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
}

export default function CommentMenu({ comment, own, onRemove, onSessionExpired }: Props) {
    const { setSession } = useReaderSession()
    const [panel, setPanel] = useState<Panel>({ kind: 'closed' })

    if (!own) return null

    async function remove() {
        setPanel({ kind: 'remove', busy: true, failed: false })
        try {
            await onRemove()
            // the node this menu sat on is a placeholder or gone by now
            setPanel({ kind: 'closed' })
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) {
                onSessionExpired()
                setSession({ authenticated: false })
                setPanel({ kind: 'closed' })
                return
            }
            // a 403 cannot happen from here, the item is only offered on the reader's own; the
            // rest is the network, and a retry is the reader's
            setPanel({ kind: 'remove', busy: false, failed: true })
        }
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
                    <button
                        type="button"
                        style={danger}
                        onClick={() => setPanel({ kind: 'remove', busy: false, failed: false })}
                    >
                        {strings.remove}
                    </button>
                </span>
            )}
            {panel.kind === 'remove' && (
                <div style={{ ...box, flexBasis: '100%' }}>
                    <p style={{ margin: 0 }}>
                        {strings.confirmRemove}
                        {comment.replyCount > 0 && ` ${strings.confirmRemoveReplies}`}
                    </p>
                    <p style={{ margin: '6px 0 0', display: 'flex', gap: 12 }}>
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
        </>
    )
}
