'use client'

import { useRef, useState } from 'react'

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

const field: React.CSSProperties = {
    width: '100%',
    maxWidth: 300,
    padding: '9px 12px',
    font: 'inherit',
    fontSize: 15,
    color: 'var(--tw-text)',
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 7,
}

export default function DeleteAccount({
    displayName,
    userId,
}: {
    displayName: string
    userId: string | null
}) {
    const [asked, setAsked] = useState(false)
    const [typed, setTyped] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const signOut = useRef<HTMLFormElement>(null)

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

        if (!response.ok) {
            setDeleting(false)
            setError('Не удалось удалить аккаунт, попробуйте позже')
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

            {!asked ? (
                <p style={{ margin: '16px 0 0' }}>
                    <button type="button" onClick={() => setAsked(true)} style={quiet}>
                        Удалить аккаунт
                    </button>
                </p>
            ) : (
                <div style={{ marginTop: 16 }}>
                    <label
                        htmlFor="confirm-delete"
                        style={{ display: 'block', fontSize: 14, marginBottom: 8 }}
                    >
                        Чтобы подтвердить, введите <b>{displayName}</b>
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                        }}
                    >
                        <input
                            id="confirm-delete"
                            value={typed}
                            onChange={(event) => setTyped(event.target.value)}
                            autoComplete="off"
                            style={field}
                        />
                        <button
                            type="button"
                            onClick={remove}
                            disabled={deleting || typed !== displayName}
                            style={danger}
                        >
                            {deleting ? 'Удаляем…' : 'Удалить навсегда'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAsked(false)
                                setTyped('')
                                setError(null)
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                font: 'inherit',
                                fontSize: 14,
                                color: 'var(--tw-text-secondary)',
                                cursor: 'pointer',
                            }}
                        >
                            Отмена
                        </button>
                    </div>
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
