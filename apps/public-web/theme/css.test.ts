import { describe, expect, it } from 'vitest'

import { themeCss } from './css'
import { DEFAULTS } from './state'

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
})
