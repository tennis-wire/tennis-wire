const dateTime = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

// «14 сентября, 18:00» — the ban plate's wording (§12.5), in the reader's own time zone
const until = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
})

export function formatWhen(iso: string): string {
    return dateTime.format(new Date(iso))
}

export function formatUntil(iso: string): string {
    return until.format(new Date(iso))
}

// Where to come back to after signing in: this page, comment and all
export function loginHref(): string {
    if (typeof window === 'undefined') return '/api/auth/login'
    const here = window.location.pathname + window.location.search + window.location.hash
    return `/api/auth/login?returnTo=${encodeURIComponent(here)}`
}
