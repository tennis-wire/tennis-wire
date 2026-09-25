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

const WHITE = '#FFFFFF'
const DARK = '#111111'

// WCAG relative luminance of a #RRGGBB colour
function luminance(hex: string): number {
    const channel = (at: number) => {
        const c = parseInt(hex.slice(at, at + 2), 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

// Text on a filled button, white or near-black, whichever stands out more: white on the light
// palettes, dark on the dark ones, whose primary is light
export function textOn(background: string): string {
    const fill = luminance(background) + 0.05
    const onWhite = (luminance(WHITE) + 0.05) / fill
    const onDark = fill / (luminance(DARK) + 0.05)
    return onWhite >= onDark ? WHITE : DARK
}

function rule(selector: string, colors: PaletteColors, scheme: 'light' | 'dark'): string {
    const body = KEYS.map((key) => `${VARIABLES[key]}:${colors[key]}`).join(';')
    const on = `--tw-on-primary:${textOn(colors.primary)};--tw-on-live:${textOn(colors.live)}`
    return `${selector}{${body};${on};color-scheme:${scheme}}`
}

function fonts(selector: string, key: FontPairKey): string {
    const pair = FONT_PAIRS[key]
    return `${selector}{--tw-font-display:${pair.display};--tw-font-body:${pair.body}}`
}

export function themeCss(): string {
    // The default look under :root, for a page the boot script could not mark: no script, no
    // storage, or a stored key that names nothing. html[...] outranks it whatever the order.
    const rules = [
        rule(':root', PALETTES[DEFAULTS.palette].colors, 'light'),
        fonts(':root', DEFAULTS.fontPair),
    ]

    for (const key of Object.keys(PALETTES) as PaletteKey[]) {
        const palette = PALETTES[key]
        rules.push(rule(`html[data-palette="${key}"]`, palette.colors, 'light'))
        rules.push(
            rule(`html[data-palette="${key}"][data-mode="dark"]`, palette.darkColors, 'dark')
        )
    }

    for (const key of Object.keys(FONT_PAIRS) as FontPairKey[]) {
        rules.push(fonts(`html[data-fonts="${key}"]`, key))
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
