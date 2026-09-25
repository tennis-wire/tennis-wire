import { describe, expect, it } from 'vitest'

import { textOn, themeCss } from './css'
import { PALETTES } from './palettes'
import { DEFAULTS } from './state'

// WCAG contrast of two #RRGGBB colours, worked out here rather than taken from css.ts
function contrast(a: string, b: string): number {
    const luminance = (hex: string) =>
        [1, 3, 5]
            .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

// Every rule body in the stylesheet under the selector it opens with
function rules(css: string): Map<string, string[]> {
    const found = new Map<string, string[]>()
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        found.set(selector, [...(found.get(selector) ?? []), body])
    }
    return found
}

describe('themeCss', () => {
    const css = rules(themeCss())

    it('puts the default look under :root, generated from the same tables', () => {
        const palette = css.get(`html[data-palette="${DEFAULTS.palette}"]`)
        const fonts = css.get(`html[data-fonts="${DEFAULTS.fontPair}"]`)

        expect(css.get(':root')).toEqual([palette?.[0], fonts?.[0]])
    })

    it('gives every filled button text that reads at the AA ratio', () => {
        for (const palette of Object.values(PALETTES)) {
            for (const colors of [palette.colors, palette.darkColors]) {
                for (const fill of [colors.primary, colors.live]) {
                    expect(contrast(textOn(fill), fill)).toBeGreaterThanOrEqual(4.5)
                }
            }
        }
    })

    it('keeps white text on the light palettes and turns it dark on the dark ones', () => {
        for (const palette of Object.values(PALETTES)) {
            expect(textOn(palette.colors.primary)).toBe('#FFFFFF')
            expect(textOn(palette.darkColors.primary)).toBe('#111111')
        }
    })

    it('carries the text colours in every palette rule', () => {
        const dark = css.get(`html[data-palette="${DEFAULTS.palette}"][data-mode="dark"]`)?.[0]

        expect(dark).toContain('--tw-on-primary:#111111')
        expect(dark).toContain('--tw-on-live:#111111')
    })
})
