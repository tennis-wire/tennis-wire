export function dayOf(iso: string): string {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export function timeOf(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}
