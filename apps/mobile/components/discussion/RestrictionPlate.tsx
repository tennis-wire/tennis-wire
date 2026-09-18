// Mirrors public-web/components/discussion/RestrictionPlate.tsx. The plate's background was a
// CSS color-mix(accentSoft 45%, transparent); RN supports #RRGGBBAA hex directly, so accentSoft
// with a 73 (~45%) alpha suffix is the same mix.

import { View } from 'react-native'

import Avatar from '../Avatar'
import { useReaderSession } from '../auth/ReaderSessionProvider'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import { formatUntil } from './format'
import { strings } from './strings'

type Props = {
    // null: a restriction with no end
    until: string | null
    // what stays under the plate: the text of a form that met the ban only on sending
    children?: React.ReactNode
}

// Where the reader would otherwise write: until when he may not, in his own time zone, or that he
// may not at all. The same plate whether the ban came with the page or with an answer to sending.
export default function RestrictionPlate({ until, children }: Props) {
    const { colors } = useTheme()
    const { session } = useReaderSession()
    const mine = session?.authenticated ? session.displayName : null

    return (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={mine} size={36} />
            <View style={{ flex: 1 }}>
                <View
                    style={{
                        marginBottom: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        backgroundColor: `${colors.accentSoft}73`,
                    }}
                >
                    <Text style={{ fontSize: 14 }}>
                        {until
                            ? strings.restrictedUntil(formatUntil(until))
                            : strings.restrictedIndefinitely}
                    </Text>
                </View>
                {children}
            </View>
        </View>
    )
}
