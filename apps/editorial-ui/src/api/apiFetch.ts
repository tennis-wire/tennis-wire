// The single place through which the editorial UI talks to the backend.
//
// Every request goes to the API gateway. It is the only backend host this app
// knows about and the only origin CORS is configured for; the services behind
// it carry no CORS of their own, so addressing them directly cannot work.

import { userManager } from '../auth/userManager'
import { createApiFetch } from './createApiFetch'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:8090'

export const apiFetch = createApiFetch({
    baseUrl: GATEWAY_URL,

    // Read at send time, never captured in a closure: after a silent renew a
    // captured token is the previous one, and the request would 401 for no
    // reason anybody could see.
    async getAccessToken() {
        const user = await userManager.getUser()
        return user && !user.expired ? user.access_token : null
    },

    // Uses the refresh token when there is one; oidc-client-ts falls back to a
    // hidden iframe otherwise, which will fail, which is the answer we want.
    async refresh() {
        try {
            const user = await userManager.signinSilent()
            return user?.access_token ?? null
        } catch {
            return null
        }
    },

    // Dropping the user makes isAuthenticated false, and RequireAuth sends the
    // browser to Keycloak. Blunt, and replaced by the expiry banner next.
    onSessionExpired() {
        void userManager.removeUser()
    },
})
