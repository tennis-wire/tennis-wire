import { FlatList, Pressable } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Text, Divider, Screen } from '../../components/ui'

const ITEMS = [
    { id: '1', title: 'Синнер выиграл Miami Open 2026', type: 'Новость', time: '2 ч назад' },
    {
        id: '2',
        title: 'Сезон Синнера: как итальянец стал доминирующей силой',
        type: 'Материал',
        time: '1 день',
    },
    {
        id: '3',
        title: 'Синнер vs Алькарас: статистика личных встреч',
        type: 'Материал',
        time: '3 дня',
    },
]

export default function TagScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>()

    return (
        <Screen>
            <Stack.Screen options={{ title: `#${slug}` }} />

            <FlatList
                data={ITEMS}
                keyExtractor={(i) => i.id}
                contentContainerStyle={{ paddingTop: 8 }}
                ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 16 }} />}
                renderItem={({ item }) => (
                    <Pressable style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                        <Text variant="caption" style={{ marginBottom: 4 }}>
                            {item.type}
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
