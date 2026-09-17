import { ScrollView, View, Pressable } from 'react-native'
import {
    useTheme,
    PALETTES,
    FONT_PAIRS,
    type PaletteKey,
    type FontPairKey,
    type ThemeMode,
} from '../../../theme'
import { Text, Card, Divider, Screen } from '../../../components/ui'

const MODES: { value: ThemeMode; label: string; icon: string; hint: string }[] = [
    { value: 'light', label: 'Светлая', icon: '☀️', hint: 'По умолчанию' },
    { value: 'dark', label: 'Тёмная', icon: '🌙', hint: 'Для вечерних матчей' },
    { value: 'system', label: 'Как в системе', icon: '📱', hint: 'Переключается сама' },
]

function ModeOption({
    label,
    icon,
    hint,
    isActive,
    onPress,
}: {
    label: string
    icon: string
    hint: string
    isActive: boolean
    onPress: () => void
}) {
    const { colors } = useTheme()

    return (
        <Pressable
            onPress={onPress}
            style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 8,
                borderRadius: 10,
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? colors.primary : colors.border,
                backgroundColor: isActive ? colors.bgAlt : 'transparent',
            }}
        >
            <Text style={{ fontSize: 22, marginBottom: 6 }}>{icon}</Text>
            <Text variant="label" style={{ fontWeight: isActive ? '600' : '400' }}>
                {label}
            </Text>
            <Text variant="caption" style={{ marginTop: 2, textAlign: 'center' }}>
                {hint}
            </Text>
        </Pressable>
    )
}

function PaletteOption({
    id,
    name,
    description,
    isActive,
    onPress,
    previewColor,
}: {
    id: string
    name: string
    description: string
    isActive: boolean
    onPress: () => void
    previewColor: string
}) {
    const { colors } = useTheme()

    return (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
            }}
        >
            {/* Color swatch */}
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: previewColor,
                    marginRight: 14,
                    borderWidth: isActive ? 3 : 1,
                    borderColor: isActive ? colors.primary : colors.border,
                }}
            />
            <View style={{ flex: 1 }}>
                <Text variant="h3">{name}</Text>
                <Text variant="caption">{description}</Text>
            </View>
            {isActive && (
                <Text variant="label" color={colors.primary}>
                    ✓
                </Text>
            )}
        </Pressable>
    )
}

function FontOption({
    name,
    description,
    isActive,
    onPress,
    sampleFont,
}: {
    name: string
    description: string
    isActive: boolean
    onPress: () => void
    sampleFont: string
}) {
    const { colors } = useTheme()

    return (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
            }}
        >
            {/* Font preview */}
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.bgAlt,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                    borderWidth: isActive ? 2 : 0,
                    borderColor: colors.primary,
                }}
            >
                <Text variant="h3" style={{ fontFamily: sampleFont, fontSize: 16 }}>
                    Aa
                </Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text variant="h3">{name}</Text>
                <Text variant="caption">{description}</Text>
            </View>
            {isActive && (
                <Text variant="label" color={colors.primary}>
                    ✓
                </Text>
            )}
        </Pressable>
    )
}

export default function SettingsScreen() {
    const { palette, fontPair, mode, setPalette, setFontPair, setMode } = useTheme()

    const paletteEntries = Object.entries(PALETTES) as [PaletteKey, (typeof PALETTES)[PaletteKey]][]
    const fontEntries = Object.entries(FONT_PAIRS) as [
        FontPairKey,
        (typeof FONT_PAIRS)[FontPairKey],
    ][]

    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Theme mode */}
                <Text variant="h2" style={{ marginBottom: 12 }}>
                    Тема
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {MODES.map((option) => (
                        <ModeOption
                            key={option.value}
                            label={option.label}
                            icon={option.icon}
                            hint={option.hint}
                            isActive={mode === option.value}
                            onPress={() => setMode(option.value)}
                        />
                    ))}
                </View>

                {/* Palettes */}
                <Text variant="h2" style={{ marginBottom: 12 }}>
                    Палитра
                </Text>
                <Card style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                    {paletteEntries.map(([key, p], i) => (
                        <View key={key}>
                            <PaletteOption
                                id={key}
                                name={p.name}
                                description={p.description}
                                isActive={palette === key}
                                onPress={() => setPalette(key)}
                                previewColor={p.colors.primary}
                            />
                            {i < paletteEntries.length - 1 && <Divider />}
                        </View>
                    ))}
                </Card>

                {/* Font pairs */}
                <Text variant="h2" style={{ marginBottom: 12 }}>
                    Шрифт
                </Text>
                <Card style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                    {fontEntries.map(([key, f], i) => (
                        <View key={key}>
                            <FontOption
                                name={f.name}
                                description={f.description}
                                isActive={fontPair === key}
                                onPress={() => setFontPair(key)}
                                sampleFont={f.display.regular}
                            />
                            {i < fontEntries.length - 1 && <Divider />}
                        </View>
                    ))}
                </Card>
            </ScrollView>
        </Screen>
    )
}
