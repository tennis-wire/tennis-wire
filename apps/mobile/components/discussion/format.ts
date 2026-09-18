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
