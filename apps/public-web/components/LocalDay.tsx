'use client'

import { useSyncExternalStore } from 'react'

import { formatDay, formatDayInUtc, formatWhen, formatWhenInUtc } from '@/lib/format'

const unchanging = () => () => {}

// A day as the reader's device has it, for pages drawn on the server. The server writes UTC's
// day and hydration keeps it; React then draws the device's day, which only differs when the two
// zones are on either side of a midnight.
// With withTime, the hour too: the zones then differ always, not only around midnight, and the
// server's UTC hour is on screen only until hydration.
export default function LocalDay({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
    const text = useSyncExternalStore(
        unchanging,
        () => (withTime ? formatWhen(iso) : formatDay(iso)),
        () => (withTime ? formatWhenInUtc(iso) : formatDayInUtc(iso))
    )
    return <time dateTime={iso}>{text}</time>
}
