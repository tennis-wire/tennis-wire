// Times on the feed, in the reader's own zone

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Just now, minutes, hours, then the date and time
export function agoOf(iso: string, now: Date): string {
    const passed = now.getTime() - new Date(iso).getTime()
    if (passed < MINUTE) return 'только что'
    if (passed < HOUR) return `${Math.floor(passed / MINUTE)} мин назад`
    if (passed < 12 * HOUR) return `${Math.floor(passed / HOUR)} ч назад`
    return clockOf(iso)
}

export function clockOf(iso: string): string {
    const date = new Date(iso)
    const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return `${day.replace('.', '')}, ${time}`
}
