// Mirrors public-web/components/Avatar.tsx. One simplification: no silhouette icon for a
// nameless author (web draws one in inline SVG). react-native-svg is not a dependency here, and
// pulling it in for one rarely-shown fallback glyph is not worth it -- a plain "?" stands in.

import { View } from 'react-native'

import { useTheme } from '../theme'
import { Text } from './ui'

// Stands in for a photo. Avatars are not in v1: avatarUrl is always null and the clients draw an
// initial, so this is what an author looks like everywhere. Neutral on purpose: a colour hashed
// from the id would have to hold its contrast against nine looks.
export default function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
    const { colors } = useTheme()
    const initial = name?.trim().charAt(0).toUpperCase()
    const fontSize = Math.round(size * 0.44)

    return (
        <View
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: size / 2,
                backgroundColor: colors.tag,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            <Text
                style={{
                    color: colors.textSecondary,
                    fontSize,
                    fontWeight: '600',
                    lineHeight: fontSize + 2,
                }}
            >
                {initial ?? '?'}
            </Text>
        </View>
    )
}
