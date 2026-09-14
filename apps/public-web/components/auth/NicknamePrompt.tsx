'use client'

import { useState, useSyncExternalStore } from 'react'

import { useReaderSession } from './ReaderSessionProvider'

const DISMISSED_KEY = 'tw-nickname-prompt-dismissed'

// "Later" holds until the tab closes. sessionStorage is read through a store
// rather than an effect so that the server render and the first client render
// agree: both say hidden.
let listeners: (() => void)[] = []

function subscribe(listener: () => void) {
    listeners.push(listener)
    return () => {
        listeners = listeners.filter((other) => other !== listener)
    }
}

function isDismissed() {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
}

function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    for (const listener of listeners) listener()
}
const PATTERN = /^[A-Za-z0-9_-]{3,24}$/

const bar: React.CSSProperties = {
    borderBottom: '1px solid var(--tw-border)',
    background: 'var(--tw-bg-alt)',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: 14,
}

export default function NicknamePrompt() {
    const { session, setSession } = useReaderSession()
    const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true)
    const [value, setValue] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    if (dismissed) return null
    if (!session?.authenticated || session.displayNameChosen) return null

    async function save() {
        if (!PATTERN.test(value)) {
            setError('3–24 символа: латиница, цифры, дефис или подчёркивание')
            return
        }
        setSaving(true)
        setError(null)
        const response = await fetch('/api/users/me', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ displayName: value }),
        })
        setSaving(false)

        if (response.status === 409) {
            setError('Такое имя уже занято')
            return
        }
        if (!response.ok) {
            setError('Не удалось сохранить, попробуйте ещё раз')
            return
        }
        const profile = await response.json()
        setSession({
            authenticated: true,
            displayName: profile.displayName,
            displayNameChosen: true,
        })
    }

    return (
        <div style={bar}>
            <span>
                Вы комментируете как <b>{session.displayName}</b>. Выбрать имя?
            </span>
            <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="например, tennis_fan"
                maxLength={24}
                style={{
                    padding: '4px 8px',
                    border: '1px solid var(--tw-border)',
                    background: 'var(--tw-surface)',
                    color: 'var(--tw-text)',
                    borderRadius: 4,
                }}
            />
            <button type="button" onClick={save} disabled={saving} style={{ cursor: 'pointer' }}>
                Сохранить
            </button>
            <button
                type="button"
                onClick={dismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tw-text-muted)',
                    cursor: 'pointer',
                }}
            >
                Позже
            </button>
            {error && <span style={{ color: 'var(--tw-live)' }}>{error}</span>}
        </div>
    )
}
