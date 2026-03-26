import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { PALETTES, type PaletteKey, type PaletteColors } from './palettes'
import { FONT_PAIRS, type FontPairIndex, type FontPair } from './fonts'
import { ThemeContext, type ThemeContextValue } from './themeDefinition'

interface ThemeState {
    paletteKey: PaletteKey
    fontIndex: FontPairIndex
    isDark: boolean
}

const STORAGE_KEY = 'tw-editor-theme'

const defaultState: ThemeState = {
    paletteKey: 'courtGreen',
    fontIndex: 0,
    isDark: false,
}

function loadState(): ThemeState {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<ThemeState>
            return {
                paletteKey:
                    parsed.paletteKey && parsed.paletteKey in PALETTES
                        ? parsed.paletteKey
                        : defaultState.paletteKey,
                fontIndex:
                    parsed.fontIndex != null &&
                    parsed.fontIndex >= 0 &&
                    parsed.fontIndex < FONT_PAIRS.length
                        ? (parsed.fontIndex as FontPairIndex)
                        : defaultState.fontIndex,
                isDark: typeof parsed.isDark === 'boolean' ? parsed.isDark : defaultState.isDark,
            }
        }
    } catch {
        // ignore
    }
    return defaultState
}

function saveState(state: ThemeState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        // ignore
    }
}

function applyCSSVariables(colors: PaletteColors, fontPair: FontPair) {
    const root = document.documentElement

    root.style.setProperty('--tw-bg', colors.bg)
    root.style.setProperty('--tw-bg-alt', colors.bgAlt)
    root.style.setProperty('--tw-surface', colors.surface)
    root.style.setProperty('--tw-primary', colors.primary)
    root.style.setProperty('--tw-primary-dark', colors.primaryDark)
    root.style.setProperty('--tw-primary-light', colors.primaryLight)
    root.style.setProperty('--tw-accent', colors.accent)
    root.style.setProperty('--tw-accent-soft', colors.accentSoft)
    root.style.setProperty('--tw-text', colors.text)
    root.style.setProperty('--tw-text-secondary', colors.textSecondary)
    root.style.setProperty('--tw-text-muted', colors.textMuted)
    root.style.setProperty('--tw-border', colors.border)
    root.style.setProperty('--tw-live', colors.live)
    root.style.setProperty('--tw-live-bg', colors.liveBg)
    root.style.setProperty('--tw-tag', colors.tag)
    root.style.setProperty('--tw-card-shadow', colors.cardShadow)

    root.style.setProperty('--tw-font-display', fontPair.display)
    root.style.setProperty('--tw-font-body', fontPair.body)
}

function loadFonts(fontPair: FontPair) {
    const id = 'tw-google-fonts'
    const el = document.getElementById(id)
    if (el) el.remove()

    const style = document.createElement('style')
    style.id = id
    style.textContent = `
        @import url('${fontPair.displayUrl}');
        @import url('${fontPair.bodyUrl}');
    `
    document.head.appendChild(style)
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ThemeState>(loadState)

    const colors = useMemo(() => {
        const palette = PALETTES[state.paletteKey]
        return state.isDark ? palette.darkColors : palette.colors
    }, [state.paletteKey, state.isDark])

    const fontPair = useMemo(() => FONT_PAIRS[state.fontIndex], [state.fontIndex])

    useEffect(() => {
        applyCSSVariables(colors, fontPair)
        loadFonts(fontPair)
        saveState(state)
    }, [colors, fontPair, state])

    const setPalette = useCallback((key: PaletteKey) => {
        setState((prev) => ({ ...prev, paletteKey: key }))
    }, [])

    const setFontIndex = useCallback((index: FontPairIndex) => {
        setState((prev) => ({ ...prev, fontIndex: index }))
    }, [])

    const toggleDark = useCallback(() => {
        setState((prev) => ({ ...prev, isDark: !prev.isDark }))
    }, [])

    const setDark = useCallback((dark: boolean) => {
        setState((prev) => ({ ...prev, isDark: dark }))
    }, [])

    const value = useMemo<ThemeContextValue>(
        () => ({
            ...state,
            colors,
            fontPair,
            setPalette,
            setFontIndex,
            toggleDark,
            setDark,
        }),
        [state, colors, fontPair, setPalette, setFontIndex, toggleDark, setDark]
    )

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
