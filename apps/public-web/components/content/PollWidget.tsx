'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { muted } from '@/components/discussion/styles'
import { loginHere } from '@/lib/auth/loginHref'
import { DiscussionError, NetworkError } from '@/lib/discussion/api'
import {
    castVote,
    fetchPoll,
    percent,
    retractVote,
    sameChoice,
    shifted,
    toggled,
    type Poll,
} from '@/lib/discussion/polls'
import { formatDeadline } from '@/lib/format'

const strings = {
    closed: 'Голосование закрыто',
    until: (when: string) => `до ${when}`,
    several: 'Можно выбрать несколько',
    signIn: 'Войдите, чтобы проголосовать',
    sessionExpired: 'Сессия истекла, войдите снова',
    loadFailed: 'Не удалось загрузить опрос',
    voteFailed: 'Не удалось сохранить голос',
    offline: 'Нет подключения к интернету',
    retry: 'Повторить',
    votes: (count: number) => {
        const last = count % 10
        const teen = count % 100 >= 11 && count % 100 <= 14
        const word =
            last === 1 && !teen ? 'голос' : last >= 2 && last <= 4 && !teen ? 'голоса' : 'голосов'
        return `${count} ${word}`
    },
}

const box: React.CSSProperties = {
    margin: '24px 0',
    padding: '16px 20px',
    border: '1px solid var(--tw-border)',
    borderLeft: '3px solid var(--tw-primary)',
    borderRadius: 8,
    background: 'var(--tw-bg-alt)',
}

const question: React.CSSProperties = { margin: '0 0 12px', fontWeight: 600, fontSize: 17 }

const hint: React.CSSProperties = { ...muted, margin: '-8px 0 12px' }

const row = (held: boolean, interactive: boolean): React.CSSProperties => ({
    position: 'relative',
    display: 'block',
    width: '100%',
    margin: '0 0 8px',
    padding: '9px 12px',
    border: `1px solid ${held ? 'var(--tw-primary)' : 'var(--tw-border)'}`,
    borderRadius: 6,
    background: 'var(--tw-surface)',
    color: 'var(--tw-text)',
    fontSize: 15,
    textAlign: 'left',
    cursor: interactive ? 'pointer' : 'default',
    overflow: 'hidden',
})

const bar = (share: number, held: boolean): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    width: `${share}%`,
    background: held ? 'var(--tw-primary)' : 'var(--tw-tag)',
    opacity: held ? 0.18 : 1,
    transition: 'width 300ms',
})

const label: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
}

type Props = { id: string; fallback: string }

// The block the editor wrote stands in until the poll is fetched, and stays when it cannot be:
// the question and the choices are readable either way. A vote lands on the screen at once and
// is taken back if the service will not have it. One write is on the way at a time, always toward
// the latest click, so quick clicks in a multiple-choice poll neither get lost nor land out of order.
export default function PollWidget({ id, fallback }: Props) {
    const { session } = useReaderSession()
    const [poll, setPoll] = useState<Poll | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [voteError, setVoteError] = useState<string | null>(null)
    const [sessionExpired, setSessionExpired] = useState(false)
    const [attempt, setAttempt] = useState(0)
    // what the service holds of this reader's choice, and what his clicks have made of it since
    const confirmed = useRef<string[]>([])
    const desired = useRef<string[]>([])
    const sending = useRef(false)
    const hintId = useId()

    useEffect(() => {
        let gone = false
        fetchPoll(id).then(
            (loaded) => {
                if (gone) return
                confirmed.current = loaded.viewerOptionIds
                desired.current = loaded.viewerOptionIds
                setPoll(loaded)
            },
            (error: unknown) => {
                if (!gone)
                    setLoadError(
                        error instanceof NetworkError ? strings.offline : strings.loadFailed
                    )
            }
        )
        return () => {
            gone = true
        }
        // the session decides whether viewerOptionIds is in the answer, so a sign-in reloads
    }, [id, attempt, session?.authenticated])

    if (poll === null) {
        return (
            <div>
                <div dangerouslySetInnerHTML={{ __html: fallback }} />
                {loadError && (
                    <p style={muted}>
                        {loadError} ·{' '}
                        <button
                            type="button"
                            style={retryStyle}
                            onClick={() => {
                                setLoadError(null)
                                setAttempt((n) => n + 1)
                            }}
                        >
                            {strings.retry}
                        </button>
                    </p>
                )}
            </div>
        )
    }

    const signedIn = session?.authenticated === true && !sessionExpired
    const canVote = signedIn && !poll.closed

    async function send() {
        sending.current = true
        try {
            while (!sameChoice(desired.current, confirmed.current)) {
                const to = desired.current
                if (to.length === 0) await retractVote(id)
                else await castVote(id, to)
                confirmed.current = to
            }
        } catch (error) {
            desired.current = confirmed.current
            setPoll((current) => current && shifted(current, confirmed.current))
            if (error instanceof DiscussionError && error.status === 401) setSessionExpired(true)
            else if (error instanceof DiscussionError && error.code === 'POLL_CLOSED')
                setPoll((current) => current && { ...current, closed: true })
            else setVoteError(error instanceof NetworkError ? strings.offline : strings.voteFailed)
        } finally {
            sending.current = false
        }
    }

    function choose(optionId: string) {
        if (poll === null) return
        const to = toggled(poll, optionId)
        desired.current = to
        setPoll(shifted(poll, to))
        setVoteError(null)
        if (!sending.current) void send()
    }

    const several = poll.multipleChoice && !poll.closed

    return (
        <div
            style={box}
            role="group"
            aria-label={poll.question}
            aria-describedby={several ? hintId : undefined}
        >
            <p style={question}>{poll.question}</p>
            {several && (
                <p id={hintId} style={hint}>
                    {strings.several}
                </p>
            )}
            {poll.options.map((option) => {
                const held = poll.viewerOptionIds.includes(option.id)
                const share = percent(option, poll)
                const inside = (
                    <>
                        <span style={bar(share, held)} aria-hidden />
                        <span style={label}>
                            <span>{option.text}</span>
                            <span style={{ ...muted, fontSize: 14, whiteSpace: 'nowrap' }}>
                                {share}% · {option.voteCount}
                            </span>
                        </span>
                    </>
                )
                if (canVote) {
                    return (
                        <button
                            key={option.id}
                            type="button"
                            style={row(held, true)}
                            aria-pressed={held}
                            onClick={() => choose(option.id)}
                        >
                            {inside}
                        </button>
                    )
                }
                if (!signedIn && !poll.closed) {
                    return (
                        <a key={option.id} href={loginHere()} style={row(held, true)}>
                            {inside}
                        </a>
                    )
                }
                return (
                    <div key={option.id} style={row(held, false)}>
                        {inside}
                    </div>
                )
            })}
            <p style={{ ...muted, margin: '4px 0 0' }}>
                {strings.votes(poll.voteCount)}
                {poll.closed && <> · {strings.closed}</>}
                {!poll.closed && poll.closesAt && (
                    <> · {strings.until(formatDeadline(poll.closesAt))}</>
                )}
                {!poll.closed && !signedIn && (
                    <>
                        {' · '}
                        <a href={loginHere()} style={{ color: 'var(--tw-primary)' }}>
                            {sessionExpired ? strings.sessionExpired : strings.signIn}
                        </a>
                    </>
                )}
                {voteError && <> · {voteError}</>}
            </p>
        </div>
    )
}

const retryStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--tw-primary)',
    cursor: 'pointer',
}
