// A one-bit store: has the session died under us?
//
// It lives outside React because both reporters are outside React — apiFetch
// when a refresh fails on a 401, and the UserManager's silentRenewError event
// when the 8 h SSO cap is reached with nobody making requests.

type Listener = () => void

const listeners = new Set<Listener>()
let expired = false

function emit(): void {
    for (const listener of listeners) listener()
}

export function reportSessionExpired(): void {
    if (expired) return
    expired = true
    emit()
}

export function clearSessionExpired(): void {
    if (!expired) return
    expired = false
    emit()
}

export function isSessionExpired(): boolean {
    return expired
}

export function subscribeToSessionExpiry(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
