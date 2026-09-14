'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ReaderSession =
    | { authenticated: false }
    | { authenticated: true; displayName: string | null; displayNameChosen: boolean }

type Store = {
    // null while the answer is on its way
    session: ReaderSession | null
    setSession: (session: ReaderSession) => void
}

const ReaderSessionContext = createContext<Store>({ session: null, setSession: () => {} })

export function useReaderSession(): Store {
    return useContext(ReaderSessionContext)
}

// One fetch for everyone who needs to know the reader: the header and the
// rename offer would otherwise ask twice on every page, and each ask costs
// user-service a call.
export default function ReaderSessionProvider({ children }: { children: React.ReactNode }) {
    // Empty on the server and on the first client render. Reading the cookie
    // while rendering would make every page dynamic and cost the HTML cache.
    const [session, setSession] = useState<ReaderSession | null>(null)

    useEffect(() => {
        let live = true
        fetch('/api/auth/session')
            .then((response) => response.json())
            .then((info: ReaderSession) => live && setSession(info))
            .catch(() => live && setSession({ authenticated: false }))
        return () => {
            live = false
        }
    }, [])

    const store = {
        session,
        setSession: useCallback((next: ReaderSession) => setSession(next), []),
    }
    return <ReaderSessionContext value={store}>{children}</ReaderSessionContext>
}
