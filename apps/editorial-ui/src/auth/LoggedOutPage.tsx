import AuthScreen from './AuthScreen'

/**
 * Where Keycloak drops the browser after signout. Deliberately outside the
 * guard: landing on a guarded route would bounce straight back into a login
 * form, which does not look like having logged out.
 */
export default function LoggedOutPage() {
    return <AuthScreen message="Вы вышли из редакции." showRetry />
}
