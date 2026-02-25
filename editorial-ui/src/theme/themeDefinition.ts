import { createContext } from 'react'
import type { PaletteColors } from './palettes'
import type { FontPair, FontPairIndex } from './fonts'
import type { PaletteKey } from './palettes'

interface ThemeState {
    paletteKey: PaletteKey
    fontIndex: FontPairIndex
    isDark: boolean
}

export interface ThemeContextValue extends ThemeState {
    colors: PaletteColors
    fontPair: FontPair
    setPalette: (key: PaletteKey) => void
    setFontIndex: (index: FontPairIndex) => void
    toggleDark: () => void
    setDark: (dark: boolean) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
