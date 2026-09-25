'use client'

import { useEffect, useRef, useState } from 'react'

import { carriesDeletionMark, confirmDeletionHref, deletionOutcome } from '@/lib/auth/deletion'
import { clearDraftsOf } from '@/lib/discussion/drafts'

// A row of the account table on the profile tab: the label on the left, the step the reader is on
// on the right
const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    padding: '12px 0',
    borderTop: '1px solid var(--tw-border)',
    fontSize: 15,
}

const hint: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text-secondary)',
    margin: '10px 0 0',
}

const quiet: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '7px 14px',
    borderRadius: 7,
    border: '1px solid var(--tw-live)',
    background: 'var(--tw-surface)',
    color: 'var(--tw-live)',
    cursor: 'pointer',
    display: 'inline-block',
    textDecoration: 'none',
}

const danger: React.CSSProperties = {
    ...quiet,
    background: 'var(--tw-live)',
    color: 'var(--tw-on-live)',
}

const cancel: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    fontSize: 14,
    color: 'var(--tw-text-secondary)',
    cursor: 'pointer',
}

const steps: React.CSSProperties = {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap',
    alignItems: 'center',
}

// idle: nothing asked yet; login: the reader is to confirm his login; last: back from it, one button
type Step = 'idle' | 'login' | 'last'

export default function DeleteAccount({ userId }: { userId: string | null }) {
    // Back from the login with the mark, the last step is open at once
    const [step, setStep] = useState<Step>(() =>
        typeof window !== 'undefined' && carriesDeletionMark(window.location.search)
            ? 'last'
            : 'idle'
    )
    const [error, setError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const box = useRef<HTMLDivElement>(null)
    const signOut = useRef<HTMLFormElement>(null)

    // The row is at the foot of the profile tab: back from the login, the reader is brought to it
    useEffect(() => {
        if (carriesDeletionMark(window.location.search))
            box.current?.scrollIntoView({ block: 'center' })
    }, [])

    // The mark leaves with the step it opened, or a reload would offer the last button again
    function goTo(next: Step, message: string | null = null) {
        if (carriesDeletionMark(window.location.search)) {
            window.history.replaceState(null, '', window.location.pathname)
        }
        setStep(next)
        setError(message)
    }

    // The server answers 202 and finishes out of band. Nothing is left to wait for here, so the
    // reader is signed out at once: the account is already shut, and a session pointing
    // at it would only fail on the next request.
    async function remove() {
        setDeleting(true)
        setError(null)

        let response: Response
        try {
            response = await fetch('/api/users/me', { method: 'DELETE' })
        } catch {
            setDeleting(false)
            setError('Не удалось удалить аккаунт, попробуйте позже')
            return
        }

        const outcome = deletionOutcome(response)
        if (outcome !== 'deleted') {
            setDeleting(false)
            if (outcome === 'confirm-again') goTo('login', 'Нужно подтвердить вход ещё раз')
            else setError('Не удалось удалить аккаунт, попробуйте позже')
            return
        }

        if (userId) clearDraftsOf(userId)
        signOut.current?.requestSubmit()
    }

    return (
        <div ref={box}>
            <div style={row}>
                <span style={{ color: 'var(--tw-text-secondary)' }}>Удаление аккаунта</span>

                {step === 'idle' && (
                    <button type="button" onClick={() => goTo('login')} style={quiet}>
                        Удалить аккаунт
                    </button>
                )}

                {step === 'login' && (
                    <span style={steps}>
                        <a href={confirmDeletionHref()} style={quiet}>
                            Подтвердить вход
                        </a>
                        <button type="button" onClick={() => goTo('idle')} style={cancel}>
                            Отмена
                        </button>
                    </span>
                )}

                {step === 'last' && (
                    <span style={steps}>
                        <button type="button" onClick={remove} disabled={deleting} style={danger}>
                            {deleting ? 'Удаляем\u2026' : 'Удалить навсегда'}
                        </button>
                        <button
                            type="button"
                            onClick={() => goTo('idle')}
                            disabled={deleting}
                            style={cancel}
                        >
                            Отмена
                        </button>
                    </span>
                )}
            </div>

            {step === 'login' && (
                <p style={{ fontSize: 14, margin: '4px 0 0' }}>
                    Чтобы удалить аккаунт, подтвердите вход тем же способом, которым входили.
                </p>
            )}

            {error && (
                <p style={{ ...hint, color: 'var(--tw-live)' }} role="alert">
                    {error}
                </p>
            )}

            {/* The rules' wording, word for word. Other people's replies are not mentioned: they
                stay, and saying so here would read as a reason to think twice about them rather
                than about this. */}
            <p style={hint}>Все ваши комментарии будут удалены. Восстановить аккаунт нельзя.</p>

            <form ref={signOut} method="post" action="/api/auth/logout" hidden />
        </div>
    )
}
