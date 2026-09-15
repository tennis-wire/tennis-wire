const dateTime = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

export function formatWhen(iso: string): string {
    return dateTime.format(new Date(iso))
}
