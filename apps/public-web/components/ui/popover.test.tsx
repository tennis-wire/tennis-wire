// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { usePopover } from './popover'

function Menu() {
    const [open, setOpen] = useState(false)
    const close = useCallback(() => setOpen(false), [])
    const { root, trigger, panelId } = usePopover(open, close)

    return (
        <>
            <button type="button">elsewhere</button>
            <div ref={root}>
                <button
                    ref={trigger}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen(!open)}
                >
                    menu
                </button>
                {open && (
                    <div id={panelId}>
                        <a href="#item">item</a>
                    </div>
                )}
            </div>
        </>
    )
}

function opened() {
    render(<Menu />)
    fireEvent.click(screen.getByText('menu'))
    expect(screen.queryByText('item')).not.toBeNull()
}

afterEach(cleanup)

describe('usePopover', () => {
    it('shuts on Escape and gives the keyboard back to the button', () => {
        opened()
        screen.getByText('item').focus()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.queryByText('item')).toBeNull()
        expect(document.activeElement).toBe(screen.getByText('menu'))
    })

    it('shuts on a press outside', () => {
        opened()

        fireEvent.pointerDown(screen.getByText('elsewhere'))

        expect(screen.queryByText('item')).toBeNull()
    })

    it('stays open on a press inside', () => {
        opened()

        fireEvent.pointerDown(screen.getByText('item'))

        expect(screen.queryByText('item')).not.toBeNull()
    })

    it('shuts when the focus leaves it', () => {
        opened()
        screen.getByText('item').focus()

        act(() => screen.getByText('elsewhere').focus())

        expect(screen.queryByText('item')).toBeNull()
    })

    it('shuts from its own button', () => {
        opened()

        fireEvent.click(screen.getByText('menu'))

        expect(screen.queryByText('item')).toBeNull()
    })

    it('leaves the page alone while shut', () => {
        render(<Menu />)
        screen.getByText('elsewhere').focus()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(document.activeElement).toBe(screen.getByText('elsewhere'))
    })
})
