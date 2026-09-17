import type { FontPairKey } from './fonts'
import type { PaletteKey } from './palettes'

// Kept in sync with public-web/theme/state.ts
// 'system' follows the OS; the other two say it outright
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

// Stored state used to be { isDark } before the third mode existed. Same migration
// public-web's state.ts does on read.
export function modeOf(stored: { mode?: ThemeMode; isDark?: boolean }): ThemeMode {
    return stored.mode ?? (stored.isDark ? 'dark' : 'light')
}
