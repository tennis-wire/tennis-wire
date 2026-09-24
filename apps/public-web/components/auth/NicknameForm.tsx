'use client'

import { useState } from 'react'

import { useReaderSession } from './ReaderSessionProvider'

// Latin letters, digits, hyphen and underscore, 3 to 24. The server holds the same rule and
// the uniqueness; this only spares the reader a round trip.
const PATTERN = /^[A-Za-z0-9_-]{3,24}$/

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

const button: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '9px 18px',
    borderRadius: 7,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: '#fff',
    cursor: 'pointer',
}

const hint: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text-secondary)',
    margin: '8px 0 0',
}

const RULE = '3\u201324 символа: латиница, цифры, дефис или подчёркивание'

export default function NicknameForm({
    displayName,
    chosen,
}: {
    displayName: string
    chosen: boolean
}) {
    const { session, setSession } = useReaderSession()
    // The field holds the name as it stands: the reader edits it rather than typing it anew
    const [value, setValue] = useState(displayName)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [saving, setSaving] = useState(false)

    async function save() {
        if (value === displayName) return
        if (!PATTERN.test(value)) {
            setError(RULE)
            return
        }
        setSaving(true)
        setError(null)
        setSaved(false)

        let response: Response
        try {
            response = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ displayName: value }),
            })
        } catch {
            setSaving(false)
            setError('Не удалось сохранить, попробуйте ещё раз')
            return
        }
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
            userId: profile.userId,
            displayName: profile.displayName,
            displayNameChosen: true,
            createdAt: profile.createdAt ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            avatarLargeUrl: profile.avatarLargeUrl ?? null,
            // a new name does not change who may edit
            editorialOrigin: session?.authenticated ? session.editorialOrigin : null,
        })
        setValue(profile.displayName)
        setSaved(true)
    }

    return (
        <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>Имя</h2>
            <p style={{ ...hint, margin: '0 0 14px' }}>
                {chosen
                    ? `Сейчас вас видят как ${displayName}.`
                    : `Сейчас у вас имя, выданное автоматически: ${displayName}. Под ним вас и видят в комментариях.`}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value)
                        setSaved(false)
                    }}
                    placeholder="например, tennis_fan"
                    maxLength={24}
                    aria-label="Новое имя"
                    style={field}
                />
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || value === '' || value === displayName}
                    style={button}
                >
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </div>

            {error && (
                <p style={{ ...hint, color: 'var(--tw-live)' }} role="alert">
                    {error}
                </p>
            )}
            {saved && <p style={hint}>Имя сохранено.</p>}
            {/* The name is not stamped onto a comment, it is looked up, so the old ones
                change with it */}
            <p style={hint}>
                {RULE}. Новое имя появится на всех ваших комментариях, включая старые.
            </p>
        </section>
    )
}
