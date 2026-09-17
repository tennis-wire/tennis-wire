// Mirrors public-web/components/auth/ReaderSessionProvider.tsx's contract
// (session/setSession), plus login/logout: on web those are server routes
// (/api/auth/login, /api/auth/logout); on mobile there is no server of its
// own, so the PKCE flow and the token calls live here instead.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'

import { CLIENT_ID, SCOPES, keycloakIssuer } from '../../lib/auth/config'
import { clearSession, loadSession, saveSession, type Session } from '../../lib/auth/session'
import { freshSession } from '../../lib/auth/refresh'
import { fetchProfile } from '../../lib/gateway/client'

WebBrowser.maybeCompleteAuthSession()

export type ReaderSession =
    | { authenticated: false }
    | {
          authenticated: true
          // null when user-service did not answer: signed in, but nothing to compare an author to
          userId: string | null
          displayName: string | null
          displayNameChosen: boolean
          createdAt: string | null
      }

type Store = {
    // null while the answer is on its way
    session: ReaderSession | null
    // null when signed out; callers that need to call the gateway read this
    // directly rather than going through a proxy, since there is none here
    accessToken: string | null
    // false until the auth request has finished loading (needs a discovery round trip)
    canLogin: boolean
    login: () => Promise<void>
    logout: () => Promise<void>
    setSession: (session: ReaderSession) => void
}

const ReaderSessionContext = createContext<Store | null>(null)

export function useReaderSession(): Store {
    const context = useContext(ReaderSessionContext)
    if (!context) {
        throw new Error('useReaderSession must be used within ReaderSessionProvider')
    }
    return context
}

// Computed once: the scheme is static, and recomputing it on every render
// would retrigger the auth-request effect below for no reason.
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'tenniswire' })

export default function ReaderSessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<ReaderSession | null>(null)
    const [tokens, setTokens] = useState<Session | null>(null)
    const discovery = AuthSession.useAutoDiscovery(keycloakIssuer())

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        { clientId: CLIENT_ID, scopes: SCOPES, redirectUri, usePKCE: true },
        discovery
    )

    // Restore a persisted session on cold start, refreshing it if it has gone stale
    useEffect(() => {
        if (!discovery) return
        let live = true
        loadSession().then(async (stored) => {
            if (!stored) {
                if (live) setSession({ authenticated: false })
                return
            }
            const fresh = await freshSession(stored, discovery)
            if (!fresh) {
                await clearSession()
                if (live) setSession({ authenticated: false })
                return
            }
            if (fresh !== stored) await saveSession(fresh)
            if (live) setTokens(fresh)
        })
        return () => {
            live = false
        }
    }, [discovery])

    // Once tokens are known (cold start or fresh login), look up the profile that goes with them
    useEffect(() => {
        if (!tokens) return
        let live = true
        fetchProfile(tokens.accessToken).then((profile) => {
            if (!live) return
            setSession({
                authenticated: true,
                userId: profile?.userId ?? null,
                displayName: profile?.displayName ?? null,
                displayNameChosen: profile?.displayNameChosen ?? true,
                createdAt: profile?.createdAt ?? null,
            })
        })
        return () => {
            live = false
        }
    }, [tokens])

    // Exchange the authorization code once the browser hands one back. Only the
    // code flow arrives this way; authentication stays null for it by design
    // (expo-auth-session only fills it in for the implicit flow), so the
    // exchange is done by hand here, the same as public-web's callback route.
    useEffect(() => {
        if (response?.type !== 'success' || !request?.codeVerifier || !discovery) return
        let live = true

        exchangeAndStore(response.params.code, request.codeVerifier, discovery)
            .then((next) => {
                if (live) setTokens(next)
            })
            .catch((error) => {
                console.error('code exchange rejected', error)
                if (live) setSession({ authenticated: false })
            })

        return () => {
            live = false
        }
        // discovery and request change identity every render before they settle;
        // re-running this on those would replay a stale response
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [response])

    const login = useCallback(async () => {
        await promptAsync()
    }, [promptAsync])

    const logout = useCallback(async () => {
        const current = tokens
        await clearSession()
        setTokens(null)
        setSession({ authenticated: false })
        // Ending the Keycloak session does not touch an offline token: that is the
        // point of one. Without this the refresh token the reader just dropped
        // keeps working for thirty idle days with nobody holding it.
        if (current && discovery?.revocationEndpoint) {
            try {
                await AuthSession.revokeAsync(
                    { clientId: CLIENT_ID, token: current.refreshToken },
                    { revocationEndpoint: discovery.revocationEndpoint }
                )
            } catch (error) {
                console.error('refresh token revocation failed', error)
            }
        }
    }, [tokens, discovery])

    const store = useMemo<Store>(
        () => ({
            session,
            accessToken: tokens?.accessToken ?? null,
            canLogin: !!request,
            login,
            logout,
            setSession: (next: ReaderSession) => setSession(next),
        }),
        [session, tokens, request, login, logout]
    )

    return <ReaderSessionContext.Provider value={store}>{children}</ReaderSessionContext.Provider>
}

async function exchangeAndStore(
    code: string,
    codeVerifier: string,
    discovery: AuthSession.DiscoveryDocument
): Promise<Session> {
    const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
            clientId: CLIENT_ID,
            code,
            redirectUri,
            extraParams: { code_verifier: codeVerifier },
        },
        discovery
    )
    if (!tokenResponse.refreshToken) {
        throw new Error('no refresh token, offline_access did not apply')
    }
    const next: Session = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        idToken: tokenResponse.idToken,
        accessExpiresAt: Math.floor(Date.now() / 1000) + (tokenResponse.expiresIn ?? 0),
    }
    await saveSession(next)
    return next
}
