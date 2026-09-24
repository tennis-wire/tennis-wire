const dateTime = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

// The ban plate's wording: day, month and time, in the reader's own time zone
const until = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
})

// A day without the hour, for what the hour says nothing about
const day = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
})

export function formatWhen(iso: string): string {
    return dateTime.format(new Date(iso))
}

export function formatUntil(iso: string): string {
    return until.format(new Date(iso))
}

export function formatDay(iso: string): string {
    return day.format(new Date(iso))
}

const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

const dayOfMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

// Days since some fixed local midnight; rounding absorbs the hour a clock change adds or takes
function dayNumber(date: Date): number {
    return Math.round(
        new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000
    )
}

// A date in a list, where the full one would crowd the line: today and yesterday in words, the
// year only once it is not this one, and the hour only while it still says something
export function formatShort(iso: string, now: Date = new Date()): string {
    const at = new Date(iso)
    const days = dayNumber(now) - dayNumber(at)
    const time = clock.format(at)
    if (days === 0) return `сегодня в ${time}`
    if (days === 1) return `вчера в ${time}`
    if (at.getFullYear() === now.getFullYear()) return `${dayOfMonth.format(at)} в ${time}`
    return day.format(at)
}
