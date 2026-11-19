'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import type { Picks } from '@/lib/tennis/picks'

// The reader's draws live in his browser only: nobody else sees them, and they are not in his
// account (yet). Where storage is shut, as in some private windows, they last until the page goes.
const PREFIX = 'tw-picks:'

const fallback = new Map<string, string>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
    listeners.add(listener)
    // Another tab of the same draw
    window.addEventListener('storage', listener)
    return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', listener)
    }
}

function read(key: string): string | null {
    try {
        return window.localStorage.getItem(PREFIX + key)
    } catch {
        return fallback.get(key) ?? null
    }
}

function write(key: string, value: string | null) {
    try {
        if (value === null) window.localStorage.removeItem(PREFIX + key)
        else window.localStorage.setItem(PREFIX + key, value)
    } catch {
        if (value === null) fallback.delete(key)
        else fallback.set(key, value)
    }
    listeners.forEach((listener) => listener())
}

function parse(raw: string | null): Picks {
    if (!raw) return {}
    try {
        const value: unknown = JSON.parse(raw)
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
        return Object.fromEntries(
            Object.entries(value).filter(
                (pair): pair is [string, string] => typeof pair[1] === 'string'
            )
        )
    } catch {
        return {}
    }
}

// The server draws no picks: they appear once the page is in the browser
export function usePicks(key: string): [Picks, (next: Picks) => void] {
    const raw = useSyncExternalStore(
        subscribe,
        () => read(key),
        () => null
    )
    const picks = useMemo(() => parse(raw), [raw])
    const save = useCallback(
        (next: Picks) => write(key, Object.keys(next).length > 0 ? JSON.stringify(next) : null),
        [key]
    )
    return [picks, save]
}
