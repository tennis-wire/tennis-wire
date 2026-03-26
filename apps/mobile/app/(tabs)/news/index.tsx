import { FlatList, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Text, Divider, Screen } from '../../../components/ui'

const ITEMS = [
    { slug: 'sinner-wins-miami', title: 'Синнер выиграл Miami Open 2026', source: 'ATP Tour', time: '2 ч назад' },
    { slug: 'rublev-injury', title: 'Рублёв снялся с турнира в Мадриде', source: 'Tennis.com', time: '4 ч назад' },
    { slug: 'wta-rankings', title: 'Швёнтек вернула первую строчку WTA', source: 'WTA', time: '5 ч назад' },
    { slug: 'medvedev-coach', title: 'Медведев объявил о смене тренера', source: 'Eurosport', time: '6 ч назад' },
    { slug: 'roland-garros-seeds', title: 'Roland Garros: стали известны первые сеяные', source: 'FFT', time: '8 ч назад' },
    { slug: 'djokovic-comeback', title: 'Джокович подтвердил участие в Roland Garros', source: 'ESPN', time: '10 ч назад' },
    { slug: 'alcaraz-davis', title: 'Алькарас подтвердил участие в Кубке Дэвиса', source: 'ITF', time: '12 ч назад' },
    { slug: 'sabalenka-form', title: 'Соболенко: «Чувствую себя лучше, чем когда-либо»', source: 'WTA Insider', time: '14 ч' },
]

export default function NewsFeedScreen() {
    const router = useRouter()

    return (
        <Screen>
            <FlatList
                data={ITEMS}
                keyExtractor={(i) => i.slug}
                ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 16 }} />}
                renderItem={({ item }) => (
                    <Pressable onPress={() => router.push(`/news/${item.slug}`)} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                        <Text variant="h3" numberOfLines={2}>{item.title}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text variant="caption">{item.source}</Text>
                            <Text variant="caption">{item.time}</Text>
                        </View>
                    </Pressable>
                )}
            />
        </Screen>
    )
}
