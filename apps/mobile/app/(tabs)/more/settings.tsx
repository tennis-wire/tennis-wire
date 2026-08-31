import { ScrollView, View, Pressable, Switch } from 'react-native'
import { useTheme, PALETTES, FONT_PAIRS, type PaletteKey, type FontPairKey } from '../../../theme'
import { Text, Card, Divider, Screen } from '../../../components/ui'

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
    const { colors, palette, fontPair, isDark, setPalette, setFontPair, toggleDark } = useTheme()

    const paletteEntries = Object.entries(PALETTES) as [PaletteKey, (typeof PALETTES)[PaletteKey]][]
    const fontEntries = Object.entries(FONT_PAIRS) as [
        FontPairKey,
        (typeof FONT_PAIRS)[FontPairKey],
    ][]

    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Dark mode */}
                <Card style={{ padding: 16, marginBottom: 20 }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <View>
                            <Text variant="h3">Тёмная тема</Text>
                            <Text variant="caption">{isDark ? 'Включена' : 'Выключена'}</Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleDark}
                            trackColor={{ false: colors.border, true: colors.primaryLight }}
                            thumbColor={isDark ? colors.primary : colors.surface}
                        />
                    </View>
                </Card>

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
