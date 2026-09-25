'use client'

import AvatarForm from '@/components/auth/AvatarForm'
import DeleteAccount from '@/components/auth/DeleteAccount'
import NicknameForm from '@/components/auth/NicknameForm'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { strings } from '@/components/discussion/strings'
import { loginHere } from '@/lib/auth/loginHref'
import { formatDay } from '@/lib/format'

const secondary: React.CSSProperties = { color: 'var(--tw-text-secondary)', fontSize: 14 }

const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    borderTop: '1px solid var(--tw-border)',
    fontSize: 15,
}

const box: React.CSSProperties = {
    padding: '24px 28px 32px',
    maxWidth: 620,
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
}

// What the rest of the site sees, changed where it is shown: the photo and the name are edited
// here, and the account ends here too
export default function ProfilePage() {
    const { session } = useReaderSession()

    if (session === null) return <p style={{ ...secondary, ...box }}>{strings.loading}</p>

    if (!session.authenticated) {
        return (
            <p style={{ ...secondary, ...box }}>
                Войдите, чтобы управлять аккаунтом &middot;{' '}
                <a href={loginHere()} style={{ color: 'var(--tw-primary)', fontWeight: 600 }}>
                    Войти
                </a>
            </p>
        )
    }

    // Signed in, but user-service did not answer: there is no profile to act on
    if (session.displayName === null) {
        return (
            <p style={{ ...secondary, ...box }}>
                Не удалось загрузить профиль &middot;{' '}
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
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
        <div style={box}>
            <div>
                <h1
                    style={{
                        fontSize: 22,
                        margin: '0 0 4px',
                    }}
                >
                    Профиль
                </h1>
                <p style={{ ...secondary, margin: 0 }}>Так вас видят другие читатели.</p>
            </div>

            <AvatarForm displayName={session.displayName} avatarLargeUrl={session.avatarLargeUrl} />
            <NicknameForm displayName={session.displayName} chosen={session.displayNameChosen} />

            <section>
                <h2
                    style={{
                        fontFamily: 'var(--tw-font-body)',
                        fontSize: 16,
                        fontWeight: 600,
                        margin: '0 0 4px',
                    }}
                >
                    Аккаунт
                </h2>
                <div style={row}>
                    <span style={{ color: 'var(--tw-text-secondary)' }}>На сайте</span>
                    <span>
                        {session.createdAt ? `с ${formatDay(session.createdAt)}` : '\u2014'}
                    </span>
                </div>
                <DeleteAccount userId={session.userId} />
            </section>
        </div>
    )
}
