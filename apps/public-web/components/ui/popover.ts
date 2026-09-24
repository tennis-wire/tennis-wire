'use client'

import { useEffect, useId, useRef } from 'react'

// A button that opens a panel beside it. Escape shuts the panel and gives the keyboard back to
// the button; a press or a focus anywhere outside shuts it as well. The items are plain links and
// buttons walked with Tab: role="menu" would promise arrow keys.
export function usePopover<Root extends HTMLElement = HTMLDivElement>(
    open: boolean,
    close: () => void
) {
    const root = useRef<Root>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const panelId = useId()

    useEffect(() => {
        if (!open) return
        const outside = (target: EventTarget | null) =>
            target instanceof Node && !root.current?.contains(target)
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            close()
            trigger.current?.focus()
        }
        const onPress = (event: PointerEvent) => {
            if (outside(event.target)) close()
        }
        const onFocus = (event: FocusEvent) => {
            if (outside(event.target)) close()
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('pointerdown', onPress)
        document.addEventListener('focusin', onFocus)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('pointerdown', onPress)
            document.removeEventListener('focusin', onFocus)
        }
    }, [open, close])

    return { root, trigger, panelId }
}

// Hangs under the button; the side it lines up with is the caller's
export const popoverPanel: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    padding: 6,
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 10,
    boxShadow: 'var(--tw-card-shadow)',
    zIndex: 20,
}
