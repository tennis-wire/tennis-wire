import type { FontPairKey } from './fonts'
import type { PaletteKey } from './palettes'

// 'system' follows the device; the other two say it outright
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeState {
    palette: PaletteKey
    fontPair: FontPairKey
    mode: ThemeMode
}

export const STORAGE_KEY = 'tw-theme'

export const DEFAULTS: ThemeState = {
    palette: 'courtGreen',
    fontPair: 'editorialClassic',
    mode: 'light',
}

// The look was stored as { isDark } before the third mode existed. The boot script in css.ts
// repeats this line — both read the same key, one before the first paint and one after.
function modeOf(stored: { mode?: ThemeMode; isDark?: boolean }): ThemeMode {
    return stored.mode ?? (stored.isDark ? 'dark' : 'light')
}

function read(): ThemeState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULTS
        const stored = JSON.parse(raw)
        return { ...DEFAULTS, ...stored, mode: modeOf(stored) }
    } catch {
        return DEFAULTS
    }
}

// The stored look as an external store: the same shape NicknamePrompt uses for sessionStorage.
// A plain useState would have to be filled from an effect, and the effect would then be the
// second thing to write the look onto <html> — after the boot script already wrote it.
let listeners: (() => void)[] = []
let current: ThemeState | null = null

export function subscribeToStored(listener: () => void) {
    listeners.push(listener)
    return () => {
        listeners = listeners.filter((other) => other !== listener)
    }
}

// Same object until something changes it: useSyncExternalStore compares by identity
export function storedTheme(): ThemeState {
    current ??= read()
    return current
}

export function serverTheme(): ThemeState {
    return DEFAULTS
}

export function storeTheme(next: ThemeState) {
    current = next
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // localStorage недоступен — облик продержится до конца вкладки
    }
    for (const listener of listeners) listener()
}
