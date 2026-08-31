import { ScrollView, View } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useTheme } from '../../theme'
import { Text, Card, Tag, Divider, Screen } from '../../components/ui'

export default function PlayerScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>()
    const { colors } = useTheme()

    return (
        <Screen>
            <Stack.Screen options={{ title: 'Игрок' }} />

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Player header */}
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: colors.bgAlt,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <Text variant="h1">ЯС</Text>
                    </View>
                    <Text variant="display">Янник Синнер</Text>
                    <Text variant="bodySmall" style={{ marginTop: 4 }}>
                        Италия · #1 ATP
                    </Text>
                </View>

                {/* Quick stats */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {[
                        { label: 'Рейтинг', value: '#1' },
                        { label: 'Возраст', value: '24' },
                        { label: 'Титулы', value: '22' },
                    ].map((s) => (
                        <Card key={s.label} style={{ flex: 1, padding: 14, alignItems: 'center' }}>
                            <Text variant="h2">{s.value}</Text>
                            <Text variant="caption">{s.label}</Text>
                        </Card>
                    ))}
                </View>

                {/* Bio */}
                <Card style={{ padding: 16, marginBottom: 20 }}>
                    <Text variant="label" style={{ marginBottom: 8 }}>
                        Информация
                    </Text>
                    <View style={{ gap: 6 }}>
                        <Text variant="body">Дата рождения: 16 августа 2001</Text>
                        <Text variant="body">Рост: 188 см</Text>
                        <Text variant="body">Игровая рука: правая</Text>
                        <Text variant="body">Тренер: Даррен Кэхилл, Симоне Вагнетти</Text>
                    </View>
                </Card>

                {/* Related content */}
                <Text variant="h2" style={{ marginBottom: 12 }}>
                    Связанный контент
                </Text>
                {[
                    { title: 'Синнер выиграл Miami Open 2026', type: 'Новость', time: '2 ч назад' },
                    { title: 'Сезон Синнера: доминирующая сила', type: 'Материал', time: '1 день' },
                ].map((item, i, arr) => (
                    <View key={item.title}>
                        <View style={{ paddingVertical: 12 }}>
                            <Text variant="caption">{item.type}</Text>
                            <Text variant="h3" style={{ marginTop: 2 }}>
                                {item.title}
                            </Text>
                            <Text variant="caption" style={{ marginTop: 4 }}>
                                {item.time}
                            </Text>
                        </View>
                        {i < arr.length - 1 && <Divider />}
                    </View>
                ))}

                <Text variant="caption" style={{ marginTop: 24, textAlign: 'center' }}>
                    slug: {slug}
                </Text>
            </ScrollView>
        </Screen>
    )
}
