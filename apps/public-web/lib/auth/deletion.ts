// Deleting an account takes a fresh login first. The reader leaves for Keycloak and comes back to the
// actions page with this mark, which opens the last step at once. The mark proves nothing:
// user-service decides on its own whether the login is recent enough.
const PARAM = 'delete'
const CONFIRMED = 'confirmed'
const ACTIONS = '/me/settings/actions'

export function confirmDeletionHref(): string {
    const back = `${ACTIONS}?${PARAM}=${CONFIRMED}`
    return `/api/auth/login?prompt=login&returnTo=${encodeURIComponent(back)}`
}

export function carriesDeletionMark(search: string): boolean {
    return new URLSearchParams(search).get(PARAM) === CONFIRMED
}

// The mark belongs to the account that left for the login. A login that came back as another one,
// or where nobody was signed in before, loses it.
export function withoutDeletionMark(path: string): string {
    const url = new URL(path, 'http://app.invalid')
    if (url.searchParams.get(PARAM) !== CONFIRMED) return path
    url.searchParams.delete(PARAM)
    return `${url.pathname}${url.search}${url.hash}`
}

export type DeletionOutcome = 'deleted' | 'confirm-again' | 'failed'

// A 401 means a fresh login either way: the login is too old for user-service, or the session is
// gone altogether.
export function deletionOutcome(response: { ok: boolean; status: number }): DeletionOutcome {
    if (response.ok) return 'deleted'
    return response.status === 401 ? 'confirm-again' : 'failed'
}
