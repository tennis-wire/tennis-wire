'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

import { FONT_PAIRS, type FontPairKey } from './fonts'
import type { PaletteKey } from './palettes'
import {
    serverTheme,
    storeTheme,
    storedTheme,
    subscribeToStored,
    type ThemeMode,
    type ThemeState,
} from './state'

interface ThemeContextValue extends ThemeState {
    // what `mode` comes to right now: under 'system' it is the device's answer
    isDark: boolean
    setPalette: (key: PaletteKey) => void
    setFontPair: (key: FontPairKey) => void
    setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToSystem(onChange: () => void) {
    const query = window.matchMedia(DARK_QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}

function systemIsDark() {
    return window.matchMedia(DARK_QUERY).matches
}

// The face files still arrive after the page: the boot script picks the family, the browser
// falls back until the sheet lands
function loadFontUrls(key: FontPairKey) {
    const pair = FONT_PAIRS[key]
    for (const url of [pair.displayUrl, pair.bodyUrl]) {
        if (document.querySelector(`link[href="${url}"]`)) continue
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = url
        document.head.appendChild(link)
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const state = useSyncExternalStore(subscribeToStored, storedTheme, serverTheme)
    const systemDark = useSyncExternalStore(subscribeToSystem, systemIsDark, () => false)

    // Under 'system' the device has the last word, and it can change its mind mid-session.
    // Read here rather than from the hook above: on the hydration render that value is still
    // the server's `false`, and writing it would undo what the boot script put on <html>.
    useEffect(() => {
        if (state.mode !== 'system') return
        const query = window.matchMedia(DARK_QUERY)
        const apply = () => {
            document.documentElement.dataset.mode = query.matches ? 'dark' : 'light'
        }
        apply()
        query.addEventListener('change', apply)
        return () => query.removeEventListener('change', apply)
    }, [state.mode])

    useEffect(() => loadFontUrls(state.fontPair), [state.fontPair])

    // Everything else onto <html> is written here, where a reader asked for it — so the only
    // writer before that is the boot script, and the two never race
    const change = useCallback((next: ThemeState) => {
        const root = document.documentElement
        root.dataset.palette = next.palette
        root.dataset.fonts = next.fontPair
        root.dataset.mode = next.mode === 'system' ? (systemIsDark() ? 'dark' : 'light') : next.mode
        storeTheme(next)
    }, [])

    const setPalette = useCallback(
        (palette: PaletteKey) => change({ ...storedTheme(), palette }),
        [change]
    )
    const setFontPair = useCallback(
        (fontPair: FontPairKey) => change({ ...storedTheme(), fontPair }),
        [change]
    )
    const setMode = useCallback((mode: ThemeMode) => change({ ...storedTheme(), mode }), [change])

    const isDark = state.mode === 'system' ? systemDark : state.mode === 'dark'

    return (
        <ThemeContext value={{ ...state, isDark, setPalette, setFontPair, setMode }}>
            {children}
        </ThemeContext>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
