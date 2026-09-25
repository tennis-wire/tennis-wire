'use client'

import Avatar from '@/components/Avatar'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'

import { formatUntil } from '@/lib/format'
import { strings } from './strings'

type Props = {
    // null: a restriction with no end
    until: string | null
    // what stays under the plate: the text of a form that met the ban only on sending
    children?: React.ReactNode
}

const row: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
}

const plate: React.CSSProperties = {
    margin: '0 0 8px',
    padding: '8px 12px',
    borderRadius: 6,
    background: 'color-mix(in srgb, var(--tw-accent-soft) 45%, transparent)',
    fontSize: 14,
}

// Where the reader would otherwise write: until when he may not, in his own time zone, or that he
// may not at all. The same plate whether the ban came with the page or with an answer to sending.
export default function RestrictionPlate({ until, children }: Props) {
    const { session } = useReaderSession()
    const mine = session?.authenticated ? session.displayName : null
    // his own photo: others are not shown it while he is restricted, he still is
    const face = session?.authenticated ? session.avatarUrl : null

    return (
        <div style={row}>
            <Avatar name={mine} src={face} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={plate}>
                    {until
                        ? strings.restrictedUntil(formatUntil(until))
                        : strings.restrictedIndefinitely}
                </p>
                {children}
            </div>
        </div>
    )
}
