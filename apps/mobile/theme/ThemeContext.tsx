/**
 * Tennis Wire Mobile — ThemeContext
 * Mirrors public-web/theme/ThemeContext.tsx API:
 *   colors, fonts, palette, fontPair, isDark, setPalette, setFontPair, toggleDark
 *
 * Differences from web:
 * - AsyncStorage instead of localStorage (async load)
 * - isReady flag for splash screen gating
 * - fonts returns expo-google-fonts names instead of CSS strings
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PALETTES, type PaletteKey, type PaletteColors } from './palettes'
import { FONT_PAIRS, type FontPairKey, type FontPairMobile } from './fonts'

const STORAGE_KEY = 'tw-theme'

interface ThemeState {
    palette: PaletteKey
    fontPair: FontPairKey
    isDark: boolean
}

interface ThemeContextValue extends ThemeState {
    colors: PaletteColors
    fonts: FontPairMobile
    isReady: boolean
    setPalette: (key: PaletteKey) => void
    setFontPair: (key: FontPairKey) => void
    toggleDark: () => void
}

const DEFAULTS: ThemeState = {
    palette: 'courtGreen',
    fontPair: 'editorialClassic',
    isDark: false,
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme()
    const [state, setState] = useState<ThemeState>(DEFAULTS)
    const [isReady, setIsReady] = useState(false)

    // Load saved preferences on mount
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((stored) => {
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored)
                        setState((prev) => ({ ...prev, ...parsed }))
                    } catch {
                        // corrupted data, use defaults
                    }
                }
            })
            .finally(() => setIsReady(true))
    }, [])

    // Persist whenever state changes (after initial load)
    useEffect(() => {
        if (isReady) {
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {})
        }
    }, [state, isReady])

    const setPalette = useCallback((key: PaletteKey) => {
        setState((prev) => ({ ...prev, palette: key }))
    }, [])

    const setFontPair = useCallback((key: FontPairKey) => {
        setState((prev) => ({ ...prev, fontPair: key }))
    }, [])

    const toggleDark = useCallback(() => {
        setState((prev) => ({ ...prev, isDark: !prev.isDark }))
    }, [])

    const palette = PALETTES[state.palette]
    const colors = state.isDark ? palette.darkColors : palette.colors
    const fonts = FONT_PAIRS[state.fontPair]

    const value = useMemo<ThemeContextValue>(
        () => ({
            ...state,
            colors,
            fonts,
            isReady,
            setPalette,
            setFontPair,
            toggleDark,
        }),
        [state, colors, fonts, isReady, setPalette, setFontPair, toggleDark]
    )

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
