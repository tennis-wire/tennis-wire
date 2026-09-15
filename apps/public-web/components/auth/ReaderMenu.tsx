'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import Avatar from '@/components/Avatar'
import { loginHere } from '@/lib/auth/loginHref'
import { clearDraftsOf } from '@/lib/discussion/drafts'

import { useReaderSession } from './ReaderSessionProvider'

const trigger: React.CSSProperties = {
    width: 36,
    height: 36,
    marginLeft: 8,
    padding: 0,
    borderRadius: '50%',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}

const dot: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--tw-accent)',
    border: '2px solid var(--tw-surface)',
}

const panel: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    padding: 6,
    minWidth: 200,
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
    boxShadow: 'var(--tw-card-shadow)',
    zIndex: 20,
}

const item: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'none',
    font: 'inherit',
    fontSize: 14,
    color: 'var(--tw-text)',
    textAlign: 'left',
    textDecoration: 'none',
    cursor: 'pointer',
}

const separator: React.CSSProperties = {
    height: 1,
    margin: '6px 8px',
    background: 'var(--tw-border)',
}

// The reader's one way in: signing in, the cabinet, signing out. Nothing is set from here —
// settings live on their own page, which opens without a session as well.
export default function ReaderMenu() {
    const { session } = useReaderSession()
    const [open, setOpen] = useState(false)
    const box = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    const signedIn = session?.authenticated === true
    const displayName = session?.authenticated ? session.displayName : null
    // The cabinet is where a name is chosen now, so the icon is what says it is worth opening
    const unnamed = session?.authenticated === true && !session.displayNameChosen

    return (
        <div ref={box} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={signedIn ? (displayName ?? 'Личный кабинет') : 'Войти'}
                style={trigger}
            >
                <Avatar name={displayName} size={36} />
                {unnamed && <span aria-hidden style={dot} />}
            </button>

            {open && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                        onClick={() => setOpen(false)}
                    />
                    {/* Empty until the session is known: a signed-in reader should not see the
                        invitation to sign in flash first */}
                    <div role="menu" style={panel}>
                        {session !== null &&
                            (signedIn ? (
                                <Account
                                    displayName={displayName}
                                    userId={session.authenticated ? session.userId : null}
                                    onNavigate={() => setOpen(false)}
                                />
                            ) : (
                                <Anonymous onNavigate={() => setOpen(false)} />
                            ))}
                    </div>
                </>
            )}
        </div>
    )
}

// A plain link, so the way in works before hydration and without JS at all. Registration and
// Google are on the Keycloak page this leads to, and are not repeated here.
function Anonymous({ onNavigate }: { onNavigate: () => void }) {
    return (
        <>
            <a href={loginHere()} role="menuitem" style={{ ...item, fontWeight: 600 }}>
                Войти
            </a>
            <Link href="/me/settings/appearance" role="menuitem" style={item} onClick={onNavigate}>
                Внешний вид
            </Link>
        </>
    )
}

function Account({
    displayName,
    userId,
    onNavigate,
}: {
    displayName: string | null
    userId: string | null
    onNavigate: () => void
}) {
    return (
        <>
            <div style={{ ...item, cursor: 'default', gap: 10 }}>
                <Avatar name={displayName} size={28} />
                <span
                    style={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {displayName ?? 'Читатель'}
                </span>
            </div>
            <div style={separator} />
            <Link href="/me" role="menuitem" style={item} onClick={onNavigate}>
                Личный кабинет
            </Link>
            {/* Drafts leave with the reader (§4.15 on a shared computer); the form goes on to
                the server as before, JS or not */}
            <form
                method="post"
                action="/api/auth/logout"
                onSubmit={() => {
                    if (userId) clearDraftsOf(userId)
                }}
            >
                <button
                    type="submit"
                    role="menuitem"
                    style={{ ...item, color: 'var(--tw-text-secondary)' }}
                >
                    Выйти
                </button>
            </form>
        </>
    )
}
