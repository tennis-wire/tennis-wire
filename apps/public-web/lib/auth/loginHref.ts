// Where the reader comes back to is the login endpoint's business; this only hands it the page.
export function buildLoginHref(here: string | null): string {
    return here ? `/api/auth/login?returnTo=${encodeURIComponent(here)}` : '/api/auth/login'
}

// This page, comment and all. On the server there is no page to point at, and the endpoint falls
// back to the Referer the browser sends, so the link works before hydration too.
export function loginHere(): string {
    const here =
        typeof window === 'undefined'
            ? null
            : window.location.pathname + window.location.search + window.location.hash
    return buildLoginHref(here)
}
