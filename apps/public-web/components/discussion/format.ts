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

// «16 сентября 2026 г.» — a day, where the hour says nothing
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
