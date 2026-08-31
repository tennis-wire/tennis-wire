import { ScrollView, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Card, Tag, LiveBadge, Screen } from '../../../components/ui'

const TOURNAMENTS = [
    {
        id: 'miami-2026',
        name: 'Miami Open 2026',
        cat: 'Masters 1000',
        surface: 'Hard',
        dates: '17 мар — 30 мар',
        city: 'Майами, США',
        live: true,
    },
    {
        id: 'monte-carlo-2026',
        name: 'Monte-Carlo Masters',
        cat: 'Masters 1000',
        surface: 'Clay',
        dates: '6 апр — 13 апр',
        city: 'Монте-Карло',
        live: false,
    },
    {
        id: 'roland-garros-2026',
        name: 'Roland Garros 2026',
        cat: 'Grand Slam',
        surface: 'Clay',
        dates: '25 мая — 8 июн',
        city: 'Париж, Франция',
        live: false,
    },
    {
        id: 'indian-wells-2026',
        name: 'Indian Wells 2026',
        cat: 'Masters 1000',
        surface: 'Hard',
        dates: '5 мар — 16 мар',
        city: 'Индиан-Уэллс, США',
        live: false,
    },
]

export default function TournamentsScreen() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Rankings CTA */}
                <Pressable
                    onPress={() => router.push('/tournaments/rankings')}
                    style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        padding: 16,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20,
                    }}
                >
                    <Text variant="h3" color="#FFFFFF">
                        Рейтинг ATP / WTA
                    </Text>
                    <Text variant="h3" color="#FFFFFF">
                        →
                    </Text>
                </Pressable>

                {/* Tournament cards */}
                {TOURNAMENTS.map((t) => (
                    <Card
                        key={t.id}
                        onPress={() => router.push(`/tournaments/${t.id}`)}
                        style={{ marginBottom: 10 }}
                    >
                        <View style={{ padding: 14 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginBottom: 6,
                                }}
                            >
                                <Tag label={t.cat} />
                                <Tag label={t.surface} />
                                {t.live && <LiveBadge />}
                            </View>
                            <Text variant="h3">{t.name}</Text>
                            <Text variant="bodySmall" style={{ marginTop: 4 }}>
                                {t.dates}
                            </Text>
                            <Text variant="caption" style={{ marginTop: 2 }}>
                                {t.city}
                            </Text>
                        </View>
                    </Card>
                ))}
            </ScrollView>
        </Screen>
    )
}
