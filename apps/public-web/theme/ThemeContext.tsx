'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { PALETTES, type PaletteKey, type PaletteColors } from './palettes'
import { FONT_PAIRS, type FontPairKey } from './fonts'

interface ThemeState {
    palette: PaletteKey
    fontPair: FontPairKey
    isDark: boolean
}

interface ThemeContextValue extends ThemeState {
    colors: PaletteColors
    fonts: { display: string; body: string }
    setPalette: (key: PaletteKey) => void
    setFontPair: (key: FontPairKey) => void
    toggleDark: () => void
}

const STORAGE_KEY = 'tw-theme'

const DEFAULTS: ThemeState = {
    palette: 'courtGreen',
    fontPair: 'editorialClassic',
    isDark: false,
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadFromStorage(): ThemeState {
    if (typeof window === 'undefined') return DEFAULTS
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return DEFAULTS
        const parsed = JSON.parse(stored)
        return { ...DEFAULTS, ...parsed }
    } catch {
        return DEFAULTS
    }
}

function saveToStorage(state: ThemeState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        // localStorage недоступен
    }
}

function applyColors(colors: PaletteColors) {
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
}

function applyFonts(fontPairKey: FontPairKey) {
    const pair = FONT_PAIRS[fontPairKey]
    const root = document.documentElement
    root.style.setProperty('--tw-font-display', pair.display)
    root.style.setProperty('--tw-font-body', pair.body)
}

function loadFontUrls(fontPairKey: FontPairKey) {
    const pair = FONT_PAIRS[fontPairKey]
    const urls = [pair.displayUrl, pair.bodyUrl]

    urls.forEach((url) => {
        const existing = document.querySelector(`link[href="${url}"]`)
        if (!existing) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = url
            document.head.appendChild(link)
        }
    })
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Lazy initializer — reads localStorage once, no setState in effect
    const [state, setState] = useState<ThemeState>(() => loadFromStorage())

    // Apply theme to DOM whenever state changes
    useEffect(() => {
        const palette = PALETTES[state.palette]
        const colors = state.isDark ? palette.darkColors : palette.colors

        applyColors(colors)
        applyFonts(state.fontPair)
        loadFontUrls(state.fontPair)
        saveToStorage(state)
    }, [state])

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
    const fontPair = FONT_PAIRS[state.fontPair]

    return (
        <ThemeContext.Provider
            value={{
                ...state,
                colors,
                fonts: { display: fontPair.display, body: fontPair.body },
                setPalette,
                setFontPair,
                toggleDark,
            }}
        >
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
