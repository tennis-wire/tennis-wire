import Avatar from '@/components/Avatar'
import type { Author } from '@/lib/discussion/types'

import { strings } from './strings'

// Someone in a row of their own, outside a comment: the ignore list, the message about a hidden
// branch. The same circle and name an author gets under a comment - a restricted one has neither
// and someone user-service does not know has no name.

export function PersonFace({ user }: { user?: Author }) {
    if (!user || 'restricted' in user) return <Avatar size={36} />
    return <Avatar name={user.displayName} size={36} />
}

export function PersonName({ user }: { user?: Author }) {
    const style: React.CSSProperties = { fontSize: 15, fontWeight: 600 }
    if (!user) return <div style={style}>{strings.nobody}</div>
    if ('restricted' in user)
        return <div style={{ ...style, color: 'var(--tw-text-muted)' }}>{strings.restricted}</div>
    return (
        <div
            style={{ ...style, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
            {user.displayName}
        </div>
    )
}
