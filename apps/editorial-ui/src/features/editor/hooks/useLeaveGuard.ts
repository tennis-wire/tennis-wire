import { useEffect, type RefObject } from 'react'
import { useBlocker } from 'react-router-dom'

interface Params {
    dirtyRef: RefObject<boolean>
    // set once the page means to go, e.g. after deleting what it showed
    leavingRef: RefObject<boolean>
    onLeave: () => void
}

// Asks before unsaved work is left behind. Inside the app the answer is final: going
// means the unsaved part is dropped. Closing the tab only gets the browser's own
// question, and whatever was typed stays in the local buffer for next time.
export function useLeaveGuard({ dirtyRef, leavingRef, onLeave }: Params) {
    const blocker = useBlocker(({ currentLocation, nextLocation }) => {
        if (leavingRef.current || !dirtyRef.current) return false
        if (currentLocation.pathname === nextLocation.pathname) return false
        // a new article moving to its own address after the first save
        const state = nextLocation.state as { continues?: string } | null
        return !state?.continues
    })

    useEffect(() => {
        if (blocker.state !== 'blocked') return
        if (window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) {
            onLeave()
            blocker.proceed()
        } else {
            blocker.reset()
        }
    }, [blocker, onLeave])

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (dirtyRef.current && !leavingRef.current) event.preventDefault()
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [dirtyRef, leavingRef])
}
