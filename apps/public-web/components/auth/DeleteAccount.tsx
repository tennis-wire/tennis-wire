'use client'

import { useRef, useState } from 'react'

import { carriesDeletionMark, confirmDeletionHref, deletionOutcome } from '@/lib/auth/deletion'
import { clearDraftsOf } from '@/lib/discussion/drafts'

const box: React.CSSProperties = {
    marginTop: 36,
    padding: '18px 20px',
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
}

const hint: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text-muted)',
    margin: '8px 0 0',
}

const danger: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '9px 18px',
    borderRadius: 7,
    border: '1px solid var(--tw-live)',
    background: 'var(--tw-live)',
    color: '#fff',
    cursor: 'pointer',
}

const quiet: React.CSSProperties = {
    ...danger,
    background: 'none',
    color: 'var(--tw-live)',
}

const quietLink: React.CSSProperties = {
    ...quiet,
    display: 'inline-block',
    textDecoration: 'none',
}

const cancel: React.CSSProperties = {
    background: 'none',
    border: 'none',
    font: 'inherit',
    fontSize: 14,
    color: 'var(--tw-text-secondary)',
    cursor: 'pointer',
}

const row: React.CSSProperties = {
    display: 'flex',
    gap: 10,
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
    const signOut = useRef<HTMLFormElement>(null)

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
        <div style={box}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Удаление аккаунта</h2>
            {/* The rules' wording, word for word. Other people's replies are not mentioned: they stay, and
                saying so here would read as a reason to think twice about them rather than
                about this. */}
            <p style={{ ...hint, margin: '8px 0 0' }}>
                Все ваши комментарии будут удалены. Восстановить аккаунт нельзя.
            </p>

            {step === 'idle' && (
                <p style={{ margin: '16px 0 0' }}>
                    <button type="button" onClick={() => goTo('login')} style={quiet}>
                        Удалить аккаунт
                    </button>
                </p>
            )}

            {step === 'login' && (
                <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 14, margin: '0 0 12px' }}>
                        Чтобы удалить аккаунт, подтвердите вход тем же способом, которым входили.
                    </p>
                    <div style={row}>
                        <a href={confirmDeletionHref()} style={quietLink}>
                            Подтвердить вход
                        </a>
                        <button type="button" onClick={() => goTo('idle')} style={cancel}>
                            Отмена
                        </button>
                    </div>
                </div>
            )}

            {step === 'last' && (
                <div style={{ ...row, marginTop: 16 }}>
                    <button type="button" onClick={remove} disabled={deleting} style={danger}>
                        {deleting ? 'Удаляем…' : 'Удалить навсегда'}
                    </button>
                    <button
                        type="button"
                        onClick={() => goTo('idle')}
                        disabled={deleting}
                        style={cancel}
                    >
                        Отмена
                    </button>
                </div>
            )}

            {error && (
                <p style={{ ...hint, color: 'var(--tw-live)' }} role="alert">
                    {error}
                </p>
            )}

            <form ref={signOut} method="post" action="/api/auth/logout" hidden />
        </div>
    )
}
