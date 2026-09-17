// Tokens live in expo-secure-store (Keychain / Keystore) rather than a sealed
// cookie: public-web keeps tokens off the browser entirely behind an
// httpOnly cookie because the browser and the app server are different
// trust domains. On mobile there is no such split, so the OS keychain is
// the closest equivalent boundary.
//
// No `sub` field: public-web keys an in-flight-refresh dedup map by it
// because one server handles many concurrent browser sessions. Mobile has
// exactly one reader per app instance, so there is nothing to dedup against.

import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'tw-session'

export type Session = {
    accessToken: string
    refreshToken: string
    /** Passed as id_token_hint on logout; kept opportunistically, absent is fine. */
    idToken?: string
    /** Epoch seconds. */
    accessExpiresAt: number
}

export async function saveSession(session: Session): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
}

export async function loadSession(): Promise<Session | null> {
    try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed?.accessToken && parsed?.refreshToken ? parsed : null
    } catch {
        // corrupted entry or SecureStore unavailable: treat as signed out
        return null
    }
}

export async function clearSession(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(SESSION_KEY)
    } catch {
        // nothing to clean up
    }
}
