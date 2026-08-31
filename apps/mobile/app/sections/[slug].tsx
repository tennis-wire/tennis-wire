import { useState } from 'react'
import { FlatList, View, Pressable } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useTheme } from '../../theme'
import { Text, Card, Divider, Screen } from '../../components/ui'

type Filter = 'all' | 'news' | 'materials'

const SECTION_NAMES: Record<string, string> = {
    trash: 'Треш-зона',
}

const ITEMS = [
    {
        id: '1',
        type: 'news' as const,
        title: 'Кирьос устроил скандал на пресс-конференции',
        time: '3 ч назад',
    },
    {
        id: '2',
        type: 'materials' as const,
        title: 'Топ-10 самых абсурдных штрафов в истории тенниса',
        time: '1 день',
    },
    {
        id: '3',
        type: 'news' as const,
        title: 'Болл-бой стал звездой TikTok после матча в Майами',
        time: '2 дня',
    },
    {
        id: '4',
        type: 'materials' as const,
        title: 'Теннисный Twitter: лучшие мемы марта',
        time: '3 дня',
    },
]

export default function SectionScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>()
    const [filter, setFilter] = useState<Filter>('all')
    const { colors } = useTheme()

    const name = SECTION_NAMES[slug ?? ''] ?? slug
    const filtered = filter === 'all' ? ITEMS : ITEMS.filter((i) => i.type === filter)

    return (
        <Screen>
            <Stack.Screen options={{ title: name }} />

            {/* Filter tabs */}
            <View
                style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
            >
                {(['all', 'news', 'materials'] as Filter[]).map((f) => (
                    <Pressable
                        key={f}
                        onPress={() => setFilter(f)}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: filter === f ? colors.primary : colors.bgAlt,
                        }}
                    >
                        <Text
                            variant="label"
                            color={filter === f ? '#FFFFFF' : colors.textSecondary}
                        >
                            {f === 'all' ? 'Все' : f === 'news' ? 'Новости' : 'Материалы'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(i) => i.id}
                ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 16 }} />}
                renderItem={({ item }) => (
                    <Pressable style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                        <Text variant="caption" style={{ marginBottom: 4 }}>
                            {item.type === 'news' ? 'Новость' : 'Материал'}
                        </Text>
                        <Text variant="h3" numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text variant="caption" style={{ marginTop: 4 }}>
                            {item.time}
                        </Text>
                    </Pressable>
                )}
            />
        </Screen>
    )
}
