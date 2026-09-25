'use client'

import { useSyncExternalStore } from 'react'

import { formatDay, formatDayInUtc } from '@/lib/format'

const unchanging = () => () => {}

// A day as the reader's device has it, for pages drawn on the server. The server writes UTC's
// day and hydration keeps it; React then draws the device's day, which only differs when the two
// zones are on either side of a midnight.
export default function LocalDay({ iso }: { iso: string }) {
    const text = useSyncExternalStore(
        unchanging,
        () => formatDay(iso),
        () => formatDayInUtc(iso)
    )
    return <time dateTime={iso}>{text}</time>
}
