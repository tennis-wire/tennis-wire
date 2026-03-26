import { useState } from 'react'
import { FlatList, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Divider, Screen } from '../../../components/ui'

const ATP = [
    { rank: 1, name: 'Синнер Я.', country: 'ITA', pts: '11 830', slug: 'sinner' },
    { rank: 2, name: 'Алькарас К.', country: 'ESP', pts: '9 255', slug: 'alcaraz' },
    { rank: 3, name: 'Джокович Н.', country: 'SRB', pts: '8 120', slug: 'djokovic' },
    { rank: 4, name: 'Медведев Д.', country: 'RUS', pts: '6 540', slug: 'medvedev' },
    { rank: 5, name: 'Рублёв А.', country: 'RUS', pts: '5 090', slug: 'rublev' },
    { rank: 6, name: 'Циципас С.', country: 'GRE', pts: '4 875', slug: 'tsitsipas' },
    { rank: 7, name: 'Руне Х.', country: 'DEN', pts: '4 610', slug: 'rune' },
    { rank: 8, name: 'Хуркач Х.', country: 'POL', pts: '4 210', slug: 'hurkacz' },
    { rank: 9, name: 'Фриц Т.', country: 'USA', pts: '3 990', slug: 'fritz' },
    { rank: 10, name: 'Де Минор А.', country: 'AUS', pts: '3 780', slug: 'de-minaur' },
]

const WTA = [
    { rank: 1, name: 'Швёнтек И.', country: 'POL', pts: '10 445', slug: 'swiatek' },
    { rank: 2, name: 'Соболенко А.', country: 'BLR', pts: '9 416', slug: 'sabalenka' },
    { rank: 3, name: 'Гофф К.', country: 'USA', pts: '7 150', slug: 'gauff' },
    { rank: 4, name: 'Рыбакина Е.', country: 'KAZ', pts: '5 873', slug: 'rybakina' },
    { rank: 5, name: 'Пегула Дж.', country: 'USA', pts: '5 490', slug: 'pegula' },
    { rank: 6, name: 'Жабер О.', country: 'TUN', pts: '4 555', slug: 'jabeur' },
    { rank: 7, name: 'Остапенко Е.', country: 'LAT', pts: '4 120', slug: 'ostapenko' },
    { rank: 8, name: 'Касаткина Д.', country: 'RUS', pts: '3 980', slug: 'kasatkina' },
    { rank: 9, name: 'Мухова К.', country: 'CZE', pts: '3 710', slug: 'muchova' },
    { rank: 10, name: 'Кис М.', country: 'USA', pts: '3 530', slug: 'keys' },
]

type Tour = 'atp' | 'wta'

export default function RankingsScreen() {
    const [tour, setTour] = useState<Tour>('atp')
    const { colors } = useTheme()
    const router = useRouter()
    const data = tour === 'atp' ? ATP : WTA

    return (
        <Screen>
            {/* Segment control */}
            <View style={{ flexDirection: 'row', margin: 16, backgroundColor: colors.bgAlt, borderRadius: 10, padding: 3 }}>
                {(['atp', 'wta'] as Tour[]).map((t) => (
                    <Pressable
                        key={t}
                        onPress={() => setTour(t)}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                            backgroundColor: tour === t ? colors.surface : 'transparent',
                        }}
                    >
                        <Text variant="label" color={tour === t ? colors.primary : colors.textMuted}>
                            {t.toUpperCase()}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Table header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 }}>
                <Text variant="caption" style={{ width: 36 }}>#</Text>
                <Text variant="caption" style={{ flex: 1 }}>Игрок</Text>
                <Text variant="caption" style={{ width: 70, textAlign: 'right' }}>Очки</Text>
            </View>

            <FlatList
                data={data}
                keyExtractor={(item) => item.slug}
                ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 16 }} />}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => router.push(`/players/${item.slug}`)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
                    >
                        <Text variant="h3" style={{ width: 36 }}>{item.rank}</Text>
                        <View style={{ flex: 1 }}>
                            <Text variant="body">{item.name}</Text>
                            <Text variant="caption">{item.country}</Text>
                        </View>
                        <Text variant="label" style={{ width: 70, textAlign: 'right' }}>{item.pts}</Text>
                    </Pressable>
                )}
            />
        </Screen>
    )
}
