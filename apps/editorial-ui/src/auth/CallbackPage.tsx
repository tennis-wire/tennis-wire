import { Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import AuthScreen from './AuthScreen'

/**
 * Landing page for the authorization code. AuthProvider performs the exchange
 * on mount; this route only decides where the person goes afterwards.
 */
export default function CallbackPage() {
    const auth = useAuth()

    if (auth.isLoading || auth.activeNavigator) {
        return <AuthScreen message="Завершаем вход…" />
    }
    if (auth.error) {
        return <AuthScreen message={`Не удалось войти: ${auth.error.message}`} showRetry />
    }

    const state = auth.user?.state as { returnTo?: string } | undefined
    return <Navigate to={state?.returnTo ?? '/editor'} replace />
}
