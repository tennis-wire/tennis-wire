import { FONT_PAIRS, type FontPairKey } from './fonts'
import { PALETTES, type PaletteColors, type PaletteKey } from './palettes'
import { DEFAULTS, STORAGE_KEY } from './state'

// Every look as plain CSS, keyed by attributes on <html>. The provider only sets those three
// attributes, so nothing writes sixteen custom properties one by one at runtime, and the boot
// script below can pick the stored look before the first paint, which is the whole point.
const VARIABLES: Record<keyof PaletteColors, string> = {
    bg: '--tw-bg',
    bgAlt: '--tw-bg-alt',
    surface: '--tw-surface',
    primary: '--tw-primary',
    primaryDark: '--tw-primary-dark',
    primaryLight: '--tw-primary-light',
    accent: '--tw-accent',
    accentSoft: '--tw-accent-soft',
    text: '--tw-text',
    textSecondary: '--tw-text-secondary',
    textMuted: '--tw-text-muted',
    border: '--tw-border',
    live: '--tw-live',
    liveBg: '--tw-live-bg',
    tag: '--tw-tag',
    cardShadow: '--tw-card-shadow',
}

const KEYS = Object.keys(VARIABLES) as (keyof PaletteColors)[]

// html[...] outranks the :root fallback in globals.css whatever the source order
function rule(selector: string, colors: PaletteColors, scheme: 'light' | 'dark'): string {
    const body = KEYS.map((key) => `${VARIABLES[key]}:${colors[key]}`).join(';')
    return `${selector}{${body};color-scheme:${scheme}}`
}

export function themeCss(): string {
    const rules: string[] = []

    for (const key of Object.keys(PALETTES) as PaletteKey[]) {
        const palette = PALETTES[key]
        rules.push(rule(`html[data-palette="${key}"]`, palette.colors, 'light'))
        rules.push(
            rule(`html[data-palette="${key}"][data-mode="dark"]`, palette.darkColors, 'dark')
        )
    }

    for (const key of Object.keys(FONT_PAIRS) as FontPairKey[]) {
        const pair = FONT_PAIRS[key]
        rules.push(
            `html[data-fonts="${key}"]{--tw-font-display:${pair.display};--tw-font-body:${pair.body}}`
        )
    }

    return rules.join('')
}

// Runs before anything is drawn, so a reader on the dark theme never sees the light one flash.
// Failure is silent and lands on the defaults: the look is a preference, not a reason to break
// the page.
export function bootScript(): string {
    return (
        `try{` +
        `var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||'{}'),` +
        `d=document.documentElement,` +
        `m=s.mode||(s.isDark?'dark':'light');` +
        `d.dataset.palette=s.palette||${JSON.stringify(DEFAULTS.palette)};` +
        `d.dataset.fonts=s.fontPair||${JSON.stringify(DEFAULTS.fontPair)};` +
        `d.dataset.mode=m==='system'` +
        `?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')` +
        `:m` +
        `}catch(e){}`
    )
}
