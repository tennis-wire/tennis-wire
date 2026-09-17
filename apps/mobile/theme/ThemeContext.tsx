// Mirrors public-web/theme/ThemeContext.tsx API: colors, fonts, palette, fontPair,
// mode, isDark, setPalette, setFontPair, setMode
//
// Differences from web:
// - AsyncStorage instead of localStorage (async load, gated by isReady)
// - 'system' mode is read from react-native's useColorScheme, which already
//   subscribes to OS appearance changes, instead of a matchMedia listener
// - fonts returns expo-google-fonts names instead of CSS strings

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PALETTES, type PaletteKey, type PaletteColors } from './palettes'
import { FONT_PAIRS, type FontPairKey, type FontPairMobile } from './fonts'
import { STORAGE_KEY, DEFAULTS, modeOf, type ThemeMode, type ThemeState } from './state'

interface ThemeContextValue extends ThemeState {
    colors: PaletteColors
    fonts: FontPairMobile
    // what `mode` comes to right now: under 'system' it is the device's answer
    isDark: boolean
    isReady: boolean
    setPalette: (key: PaletteKey) => void
    setFontPair: (key: FontPairKey) => void
    setMode: (mode: ThemeMode) => void
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
                        setState((prev) => ({ ...prev, ...parsed, mode: modeOf(parsed) }))
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

    const setMode = useCallback((mode: ThemeMode) => {
        setState((prev) => ({ ...prev, mode }))
    }, [])

    const isDark = state.mode === 'system' ? systemScheme === 'dark' : state.mode === 'dark'
    const palette = PALETTES[state.palette]
    const colors = isDark ? palette.darkColors : palette.colors
    const fonts = FONT_PAIRS[state.fontPair]

    const value = useMemo<ThemeContextValue>(
        () => ({
            ...state,
            colors,
            fonts,
            isDark,
            isReady,
            setPalette,
            setFontPair,
            setMode,
        }),
        [state, colors, fonts, isDark, isReady, setPalette, setFontPair, setMode]
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
