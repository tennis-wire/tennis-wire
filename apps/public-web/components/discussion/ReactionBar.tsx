'use client'

import { EMOJI } from '@/lib/discussion/reactions'
import type { Comment, ReactionSlot } from '@/lib/discussion/types'

import { strings } from './strings'
import { muted } from './styles'

type Props = {
    comment: Comment
    // false on one's own comment and for a reader who is not signed in: the row still shows the
    // counts, it just does not take a tap
    canReact: boolean
    // where to send someone who is not signed in; absent on one's own comment, where signing in
    // would not help
    loginHref?: string
    onReact: (comment: Comment, slot: ReactionSlot, to: string | null) => void
}

const row: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    margin: '10px 0 0',
}

// A chip that leads to the login is quieter than one that takes a tap: it only shows the count
const chip = (held: boolean, live: boolean, quiet: boolean): React.CSSProperties => ({
    fontSize: 13,
    lineHeight: 1.2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 14,
    textDecoration: 'none',
    border: `1px solid ${held ? 'var(--tw-primary)' : 'var(--tw-border)'}`,
    background: held ? 'var(--tw-tag)' : 'transparent',
    color: held ? 'var(--tw-primary)' : quiet ? 'var(--tw-text-muted)' : 'var(--tw-text)',
    cursor: live ? 'pointer' : 'default',
})

export default function ReactionBar({ comment, canReact, loginHref, onReact }: Props) {
    const vote = comment.viewerVote ?? null
    const emoji = comment.viewerEmoji ?? null

    // Tapping what is already held takes it out; tapping the other replaces it in one request
    function put(slot: ReactionSlot, value: string, held: boolean) {
        onReact(comment, slot, held ? null : value)
    }

    // An emoji nobody used is offered only to someone who can put one there
    const emojiShown = EMOJI.filter(({ key }) => canReact || (comment.emojiCounts[key] ?? 0) > 0)

    return (
        <p style={row}>
            <Chip
                held={vote === 'like'}
                label={strings.like}
                glyph="👍"
                count={comment.likeCount}
                onClick={canReact ? () => put('vote', 'like', vote === 'like') : undefined}
                loginHref={canReact ? undefined : loginHref}
            />
            <Chip
                held={vote === 'dislike'}
                label={strings.dislike}
                glyph="👎"
                count={comment.dislikeCount}
                onClick={canReact ? () => put('vote', 'dislike', vote === 'dislike') : undefined}
                loginHref={canReact ? undefined : loginHref}
            />

            {emojiShown.length > 0 && (
                <span style={{ ...muted, margin: '0 2px' }} aria-hidden>
                    &middot;
                </span>
            )}

            {emojiShown.map(({ key, glyph, label }) => (
                <Chip
                    key={key}
                    held={emoji === key}
                    label={label}
                    glyph={glyph}
                    count={comment.emojiCounts[key] ?? 0}
                    onClick={canReact ? () => put('emoji', key, emoji === key) : undefined}
                    loginHref={canReact ? undefined : loginHref}
                />
            ))}
        </p>
    )
}

type ChipProps = {
    held: boolean
    label: string
    glyph: string
    count: number
    // exactly one of the two: a tap to make, or a login to send him to
    onClick?: () => void
    loginHref?: string
}

// One shape for the three states: a button for someone who may react, a link to the login for
// someone who is not signed in, and plain text on one's own comment.
function Chip({ held, label, glyph, count, onClick, loginHref }: ChipProps) {
    const style = chip(
        held,
        onClick !== undefined || loginHref !== undefined,
        !onClick && !!loginHref
    )
    const inside = (
        <>
            <span aria-hidden>{glyph}</span>
            {count > 0 && <span>{count}</span>}
        </>
    )
    if (onClick) {
        return (
            <button
                type="button"
                aria-pressed={held}
                aria-label={label}
                style={style}
                onClick={onClick}
            >
                {inside}
            </button>
        )
    }
    if (loginHref) {
        return (
            <a href={loginHref} aria-label={`${label}: ${strings.signIn}`} style={style}>
                {inside}
            </a>
        )
    }
    return (
        <span aria-label={label} style={style}>
            {inside}
        </span>
    )
}
