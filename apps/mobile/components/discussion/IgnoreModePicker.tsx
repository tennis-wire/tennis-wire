// Mirrors public-web/components/discussion/IgnoreModePicker.tsx. RN has no radio input, so the
// dot is a small View drawn by hand and selection is just a Pressable per row comparing against
// state -- no native grouping (useId's whole purpose there) needed for that.

import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { BLOCK_MODES, type BlockMode } from '../../lib/discussion/modes'
import { useTheme, type PaletteColors } from '../../theme'
import { Text } from '../ui'
import { strings } from './strings'
import { discussionStyles } from './styles'

type Props = {
    // what it opens on: soft for someone not ignored yet, the current mode otherwise
    initial: BlockMode
    confirmLabel: string
    busy: boolean
    // why the last try did not go through
    failure: string | null
    onConfirm: (mode: BlockMode) => void
    onCancel: () => void
}

function Radio({ selected, colors }: { selected: boolean; colors: PaletteColors }) {
    return (
        <View
            style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                marginTop: 2,
                borderColor: selected ? colors.primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {selected && (
                <View
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary,
                    }}
                />
            )}
        </View>
    )
}

// Chosen here, sent by whoever holds the picker: the comment menu for a new ignore, the cabinet
// for a change. The request and its outcome are theirs; this only keeps the choice.
export default function IgnoreModePicker({
    initial,
    confirmLabel,
    busy,
    failure,
    onConfirm,
    onCancel,
}: Props) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const [mode, setMode] = useState(initial)

    return (
        <View accessibilityRole="radiogroup" accessibilityLabel={strings.ignoreMode}>
            {BLOCK_MODES.map((value) => (
                <Pressable
                    key={value}
                    disabled={busy}
                    onPress={() => setMode(value)}
                    style={{
                        flexDirection: 'row',
                        gap: 10,
                        alignItems: 'flex-start',
                        paddingVertical: 6,
                    }}
                >
                    <Radio selected={mode === value} colors={colors} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14 }}>{strings.modes[value]}</Text>
                        <Text style={[styles.muted, { marginTop: 2 }]}>
                            {strings.modeHints[value]}
                        </Text>
                    </View>
                </Pressable>
            ))}

            {mode === 'subtree_removal' && (
                <Text style={{ marginTop: 4, fontSize: 13, color: colors.live }}>
                    {strings.subtreeWarning}
                </Text>
            )}

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <Pressable
                    disabled={busy}
                    onPress={() => onConfirm(mode)}
                    style={{
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: 7,
                        backgroundColor: colors.primary,
                        opacity: busy ? 0.6 : 1,
                    }}
                >
                    <Text style={{ fontSize: 14, color: '#fff' }}>
                        {busy ? strings.saving : confirmLabel}
                    </Text>
                </Pressable>
                <Pressable disabled={busy} onPress={onCancel}>
                    <Text
                        style={[styles.linkButton, { fontSize: 14, color: colors.textSecondary }]}
                    >
                        {strings.cancel}
                    </Text>
                </Pressable>
            </View>

            {failure && (
                <Text accessibilityRole="alert" style={[styles.muted, { marginTop: 8 }]}>
                    {failure}
                </Text>
            )}
        </View>
    )
}
