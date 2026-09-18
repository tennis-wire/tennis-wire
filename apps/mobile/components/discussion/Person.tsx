// Mirrors public-web/components/discussion/Person.tsx.

import Avatar from '../Avatar'
import type { Author } from '../../lib/discussion/types'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import { strings } from './strings'

// Someone in a row of their own, outside a comment: the ignore list, the message about a hidden
// branch. The same circle and name an author gets under a comment - a restricted one has neither
// and someone user-service does not know has no name.

export function PersonFace({ user }: { user?: Author }) {
    if (!user || 'restricted' in user) return <Avatar size={36} />
    return <Avatar name={user.displayName} size={36} />
}

export function PersonName({ user }: { user?: Author }) {
    const { colors } = useTheme()
    if (!user) return <Text style={{ fontSize: 15, fontWeight: '600' }}>{strings.nobody}</Text>
    if ('restricted' in user)
        return (
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>
                {strings.restricted}
            </Text>
        )
    return (
        <Text style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
            {user.displayName}
        </Text>
    )
}
