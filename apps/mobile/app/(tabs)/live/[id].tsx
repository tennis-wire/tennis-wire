import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, LiveBadge, Card, Divider, Screen } from '../../../components/ui'

const STATS = [
    { label: 'Эйсы', v1: '8', v2: '5' },
    { label: 'Двойные', v1: '2', v2: '3' },
    { label: '% 1-й подачи', v1: '68%', v2: '62%' },
    { label: 'Виннерсы', v1: '24', v2: '18' },
    { label: 'Невын. ошибки', v1: '12', v2: '19' },
]

export default function MatchDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const { colors } = useTheme()

    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Tournament + round */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Text variant="caption" style={{ marginBottom: 6 }}>Miami Open 2026 · Финал</Text>
                    <LiveBadge />
                </View>

                {/* Scoreboard */}
                <Card style={{ padding: 20, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* Player 1 */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <View style={{
                                width: 56, height: 56, borderRadius: 28,
                                backgroundColor: colors.bgAlt,
                                justifyContent: 'center', alignItems: 'center', marginBottom: 8,
                            }}>
                                <Text variant="h3">ЯС</Text>
                            </View>
                            <Text variant="h3">Синнер Я.</Text>
                            <Text variant="caption">ITA · #1</Text>
                        </View>

                        {/* Score */}
                        <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                            <Text variant="display">6-4</Text>
                            <Text variant="display">3-2</Text>
                        </View>

                        {/* Player 2 */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <View style={{
                                width: 56, height: 56, borderRadius: 28,
                                backgroundColor: colors.bgAlt,
                                justifyContent: 'center', alignItems: 'center', marginBottom: 8,
                            }}>
                                <Text variant="h3">КА</Text>
                            </View>
                            <Text variant="h3">Алькарас К.</Text>
                            <Text variant="caption">ESP · #2</Text>
                        </View>
                    </View>
                </Card>

                {/* Stats */}
                <Text variant="h2" style={{ marginBottom: 12 }}>Статистика</Text>
                <Card style={{ padding: 16 }}>
                    {STATS.map((stat, i) => (
                        <View key={stat.label}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                                <Text variant="h3" style={{ width: 36, textAlign: 'center' }}>{stat.v1}</Text>
                                <Text variant="bodySmall" style={{ flex: 1, textAlign: 'center' }}>{stat.label}</Text>
                                <Text variant="h3" style={{ width: 36, textAlign: 'center' }}>{stat.v2}</Text>
                            </View>
                            {i < STATS.length - 1 && <Divider />}
                        </View>
                    ))}
                </Card>

                <Text variant="caption" style={{ marginTop: 24, textAlign: 'center' }}>match id: {id}</Text>
            </ScrollView>
        </Screen>
    )
}
