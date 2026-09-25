// @vitest-environment jsdom
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import LocalDay from './LocalDay'

// A zone far from UTC, set before the formatters are made: 20:30 UTC on the 24th is already the
// morning of the 25th there
vi.hoisted(() => {
    process.env.TZ = 'Asia/Vladivostok'
})

// Hydrated by hand here, not through testing-library, which would set this itself
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PUBLISHED = '2026-09-24T20:30:00Z'

describe('LocalDay', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('is written in UTC on the server', () => {
        expect(renderToString(<LocalDay iso={PUBLISHED} />)).toContain('24 сентября 2026 г.')
    })

    it('shows the device day once the page is hydrated, and keeps the moment in dateTime', async () => {
        const box = document.createElement('div')
        box.innerHTML = renderToString(<LocalDay iso={PUBLISHED} />)
        document.body.append(box)
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

        await act(async () => {
            hydrateRoot(box, <LocalDay iso={PUBLISHED} />)
        })

        expect(box.querySelector('time')?.textContent).toBe('25 сентября 2026 г.')
        expect(box.querySelector('time')?.getAttribute('dateTime')).toBe(PUBLISHED)
        expect(errors).not.toHaveBeenCalled()
        errors.mockRestore()
    })
})
