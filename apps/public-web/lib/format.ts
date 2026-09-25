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
const DAY = { day: 'numeric', month: 'long', year: 'numeric' } as const
const day = new Intl.DateTimeFormat('ru-RU', DAY)
const dayInUtc = new Intl.DateTimeFormat('ru-RU', { ...DAY, timeZone: 'UTC' })

export function formatWhen(iso: string): string {
    return dateTime.format(new Date(iso))
}

export function formatUntil(iso: string): string {
    return until.format(new Date(iso))
}

export function formatDay(iso: string): string {
    return day.format(new Date(iso))
}

// What the server writes for a day it draws: it cannot know the reader's zone. LocalDay puts the
// reader's own day in its place once the page is his.
export function formatDayInUtc(iso: string): string {
    return dayInUtc.format(new Date(iso))
}

// Month and year in the genitive a phrase needs ("с сентября 2026 г."). Intl gives that form
// only next to a day, so the day is formatted and left out.
export function formatMonthYear(iso: string): string {
    const parts = day.formatToParts(new Date(iso))
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? ''
    return `${part('month')} ${part('year')} г.`
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
