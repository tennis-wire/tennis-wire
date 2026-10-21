import { useCallback, useEffect, useRef, useState } from 'react'

export const UNDO_MS = 5000

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set)
    next.delete(id)
    return next
}

// An item disappears at once and is deleted UNDO_MS later, unless undone. One waits at a time:
// deleting the next sends the previous right away, and so does leaving the page
export function useUndoableDelete(
    commit: (id: string) => Promise<void>,
    onFailed: (id: string) => void
) {
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
    const [pending, setPending] = useState<string | null>(null)
    const pendingRef = useRef<string | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const commitRef = useRef(commit)
    const failedRef = useRef(onFailed)

    useEffect(() => {
        commitRef.current = commit
        failedRef.current = onFailed
    })

    const take = useCallback((): string | null => {
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = null
        const id = pendingRef.current
        pendingRef.current = null
        setPending(null)
        return id
    }, [])

    const flush = useCallback(() => {
        const id = take()
        if (id === null) return
        commitRef.current(id).catch(() => {
            setHidden((before) => without(before, id))
            failedRef.current(id)
        })
    }, [take])

    const remove = useCallback(
        (id: string) => {
            flush()
            setHidden((before) => new Set(before).add(id))
            pendingRef.current = id
            setPending(id)
            timer.current = setTimeout(flush, UNDO_MS)
        },
        [flush]
    )

    const undo = useCallback(() => {
        const id = take()
        if (id !== null) setHidden((before) => without(before, id))
    }, [take])

    // what was asked for is done even if the page is left before the time is up
    useEffect(() => flush, [flush])

    return { hidden, pending, remove, undo }
}
