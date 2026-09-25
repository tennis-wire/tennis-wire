'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'

import Avatar from '@/components/Avatar'
import { popoverPanel, usePopover } from '@/components/ui/popover'
import { loginHere } from '@/lib/auth/loginHref'
import { clearDraftsOf } from '@/lib/discussion/drafts'

import { useReaderSession } from './ReaderSessionProvider'

const triggerStyle: React.CSSProperties = {
    width: 34,
    height: 34,
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

const panel: React.CSSProperties = { ...popoverPanel, right: 0, minWidth: 200 }

// No background: the class gives one under the pointer, and an inline one would win over it
const item: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: 'none',
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

// The reader's one way in: signing in, the cabinet, signing out. Nothing is set from here:
// settings live on their own page, which opens without a session as well.
export default function ReaderMenu() {
    const { session } = useReaderSession()
    const [open, setOpen] = useState(false)
    const close = useCallback(() => setOpen(false), [])
    const { root, trigger, panelId } = usePopover(open, close)

    const signedIn = session?.authenticated === true
    const displayName = session?.authenticated ? session.displayName : null
    const avatarUrl = session?.authenticated ? session.avatarUrl : null
    // The cabinet is where a name is chosen now, so the icon is what says it is worth opening
    const unnamed = session?.authenticated === true && !session.displayNameChosen

    return (
        <div ref={root} style={{ position: 'relative' }}>
            <button
                ref={trigger}
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={signedIn ? (displayName ?? 'Личный кабинет') : 'Войти'}
                style={triggerStyle}
            >
                <Avatar name={displayName} src={avatarUrl} size={34} />
                {unnamed && <span aria-hidden style={dot} />}
            </button>

            {/* Empty until the session is known: a signed-in reader should not see the
                invitation to sign in flash first */}
            {open && (
                <div id={panelId} style={panel}>
                    {session !== null &&
                        (signedIn ? (
                            <Account
                                displayName={displayName}
                                avatarUrl={avatarUrl}
                                userId={session.authenticated ? session.userId : null}
                                onNavigate={close}
                            />
                        ) : (
                            <Anonymous onNavigate={close} />
                        ))}
                </div>
            )}
        </div>
    )
}

// A plain link, so the way in works before hydration and without JS at all. Registration and
// Google are on the Keycloak page this leads to, and are not repeated here.
function Anonymous({ onNavigate }: { onNavigate: () => void }) {
    return (
        <>
            <a href={loginHere()} className="tw-menu-item" style={{ ...item, fontWeight: 600 }}>
                Войти
            </a>
            <Link
                href="/me/settings/appearance"
                className="tw-menu-item"
                style={item}
                onClick={onNavigate}
            >
                Внешний вид
            </Link>
        </>
    )
}

function Account({
    displayName,
    avatarUrl,
    userId,
    onNavigate,
}: {
    displayName: string | null
    avatarUrl: string | null
    userId: string | null
    onNavigate: () => void
}) {
    return (
        <>
            <div style={{ ...item, cursor: 'default', gap: 10 }}>
                <Avatar name={displayName} src={avatarUrl} size={28} />
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
            <Link href="/me" className="tw-menu-item" style={item} onClick={onNavigate}>
                Личный кабинет
            </Link>
            {/* Drafts leave with the reader, for a shared computer; the form goes on to
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
                    className="tw-menu-item"
                    style={{ ...item, color: 'var(--tw-text-secondary)' }}
                >
                    Выйти
                </button>
            </form>
        </>
    )
}
