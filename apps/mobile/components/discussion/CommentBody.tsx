// Mirrors public-web/components/discussion/CommentBody.tsx. pre-wrap/overflow-wrap need no RN
// equivalent -- Text already preserves newlines and wraps by default. A link becomes a nested
// Text with onPress opening it via Linking, RN's way of styling one run inside a larger string
// (there is no <a> here).

import { Linking, Text as RNText } from 'react-native'

import { splitLinks } from '../../lib/discussion/text'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import { strings } from './strings'

// Plain text with the links drawn; the rest is left exactly as written
export default function CommentBody({ body }: { body: string }) {
    const { colors } = useTheme()

    return (
        <Text style={{ marginTop: 6 }}>
            {splitLinks(body).map((part, index) =>
                part.kind === 'text' ? (
                    part.text
                ) : (
                    <RNText
                        key={index}
                        style={{ color: colors.primary }}
                        onPress={() => Linking.openURL(part.href)}
                    >
                        {part.href}
                    </RNText>
                )
            )}
        </Text>
    )
}

export function Placeholder({ children }: { children: string }) {
    const { colors } = useTheme()
    return (
        <Text style={{ marginTop: 6, color: colors.textMuted, fontStyle: 'italic' }}>
            {children}
        </Text>
    )
}

export function placeholderFor(visibility: 'gravestone' | 'deleted' | 'removed'): string {
    switch (visibility) {
        case 'gravestone':
            return strings.hidden
        case 'deleted':
            return strings.deleted
        case 'removed':
            return strings.removed
    }
}
