import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import AuthScreen from './AuthScreen'
import SessionExpiredBanner from './SessionExpiredBanner'

/**
 * Sends anonymous visitors to Keycloak and holds the tree until a token is in
 * hand. With tokens in memory this runs on every reload, not just the first
 * visit, which is why the current path is carried across the redirect.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
    const auth = useAuth()
    const location = useLocation()
    // StrictMode mounts effects twice in development; a second signinRedirect
    // would overwrite the stored PKCE verifier mid-flight.
    const redirecting = useRef(false)

    useEffect(() => {
        if (auth.isLoading || auth.activeNavigator || auth.isAuthenticated) return
        if (redirecting.current) return
        redirecting.current = true
        void auth.signinRedirect({
            state: { returnTo: location.pathname + location.search },
        })
    }, [auth, location])

    // A dead session is not a failed sign-in. react-oidc-context reports a
    // failed silent renew through auth.error while leaving the user loaded, so
    // checking error first would swap the editor for a full-page message —
    // unmounting the tree the banner exists to keep alive.
    if (!auth.isAuthenticated) {
        return auth.error ? (
            <AuthScreen message={`Не удалось войти: ${auth.error.message}`} showRetry />
        ) : (
            <AuthScreen message="Проверяем вход…" />
        )
    }

    return (
        <>
            {children}
            <SessionExpiredBanner />
        </>
    )
}
