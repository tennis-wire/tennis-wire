// The single UserManager instance for the app.
//
// It is created here rather than by AuthProvider so that non-React code can
// reach it: apiFetch needs the current token at the moment a request goes out,
// and reading it from React state would hand out whatever the last render
// captured, which after a silent renew is the previous token.

import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts'

const AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8180/realms/tennis-wire'
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'editorial-ui'

export const userManager = new UserManager({
    authority: AUTHORITY,
    client_id: CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri: `${window.location.origin}/logged-out`,
    response_type: 'code',
    // profile and email are default client scopes in Keycloak and arrive either
    // way; listing them says out loud which claims the app relies on.
    scope: 'openid profile email',

    // Tokens die with the tab. A reload costs one silent round trip through
    // Keycloak instead of leaving a refresh token on disk for an XSS to find.
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    // Not the default: oidc-client-ts puts the PKCE verifier in localStorage,
    // where an abandoned redirect leaves it until some later signin sweeps it.
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),

    // Both already default in v3; spelled out because the token policy depends
    // on them. Renewal every ~4 min also keeps the 30 min SSO idle timer from
    // ever firing while a tab is open, so the session lives to the 8 h cap.
    automaticSilentRenew: true,
    // Session monitoring needs a hidden iframe and third-party cookies.
    monitorSession: false,
})

/** Drops ?code and ?state from the URL so a reload cannot replay a used code. */
export function onSigninCallback(): void {
    window.history.replaceState({}, document.title, window.location.pathname)
}
