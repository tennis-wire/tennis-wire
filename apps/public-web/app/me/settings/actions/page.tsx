'use client'

import AvatarForm from '@/components/auth/AvatarForm'
import DeleteAccount from '@/components/auth/DeleteAccount'
import NicknameForm from '@/components/auth/NicknameForm'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { loginHere } from '@/lib/auth/loginHref'

const muted: React.CSSProperties = { color: 'var(--tw-text-muted)', fontSize: 14 }

export default function ActionsPage() {
    const { session } = useReaderSession()

    return (
        <div>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 22, margin: '0 0 4px' }}>
                Действия
            </h1>
            <p style={{ ...muted, margin: '0 0 28px' }}>Что можно сделать с аккаунтом.</p>

            <Body session={session} />
        </div>
    )
}

function Body({ session }: { session: ReturnType<typeof useReaderSession>['session'] }) {
    if (session === null) return <p style={muted}>Загрузка…</p>

    if (!session.authenticated) {
        return (
            <p style={muted}>
                Войдите, чтобы управлять аккаунтом ·{' '}
                <a href={loginHere()} style={{ color: 'var(--tw-primary)' }}>
                    Войти
                </a>
            </p>
        )
    }

    // Signed in, but user-service did not answer: there is no profile to act on
    if (session.displayName === null) {
        return (
            <p style={muted}>
                Не удалось загрузить профиль ·{' '}
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        color: 'var(--tw-primary)',
                        cursor: 'pointer',
                    }}
                >
                    Повторить
                </button>
            </p>
        )
    }

    return (
        <>
            <AvatarForm displayName={session.displayName} avatarLargeUrl={session.avatarLargeUrl} />
            <NicknameForm displayName={session.displayName} chosen={session.displayNameChosen} />
            <DeleteAccount userId={session.userId} />
        </>
    )
}
