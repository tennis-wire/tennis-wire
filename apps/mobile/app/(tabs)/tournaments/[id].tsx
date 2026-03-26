import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Card, Tag, Screen } from '../../../components/ui'

const SEEDS = [
    { seed: 1, name: 'Синнер Я.', country: 'ITA' },
    { seed: 2, name: 'Алькарас К.', country: 'ESP' },
    { seed: 3, name: 'Джокович Н.', country: 'SRB' },
    { seed: 4, name: 'Медведев Д.', country: 'RUS' },
    { seed: 5, name: 'Рублёв А.', country: 'RUS' },
    { seed: 6, name: 'Циципас С.', country: 'GRE' },
    { seed: 7, name: 'Руне Х.', country: 'DEN' },
    { seed: 8, name: 'Хуркач Х.', country: 'POL' },
]

export default function TournamentDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const { colors } = useTheme()

    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text variant="display">Miami Open 2026</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Tag label="Masters 1000" />
                    <Tag label="Hard" />
                </View>

                {/* Info card */}
                <Card style={{ marginTop: 20, padding: 16 }}>
                    <Text variant="label">Информация</Text>
                    <View style={{ marginTop: 8, gap: 6 }}>
                        <Text variant="body">Даты: 17 марта — 30 марта 2026</Text>
                        <Text variant="body">Место: Майами, Флорида, США</Text>
                        <Text variant="body">Покрытие: Hard (открытый)</Text>
                        <Text variant="body">Призовой фонд: $8,800,000</Text>
                    </View>
                </Card>

                {/* Draw placeholder */}
                <Text variant="h2" style={{ marginTop: 24, marginBottom: 12 }}>Сетка (draw)</Text>
                <View style={{
                    height: 180, backgroundColor: colors.bgAlt, borderRadius: 12,
                    justifyContent: 'center', alignItems: 'center',
                }}>
                    <Text variant="body">Интерактивная сетка — TBD</Text>
                </View>

                {/* Seeds */}
                <Text variant="h2" style={{ marginTop: 24, marginBottom: 12 }}>Сеяные</Text>
                <Card style={{ padding: 16 }}>
                    {SEEDS.map((p) => (
                        <View key={p.seed} style={{ flexDirection: 'row', paddingVertical: 8, alignItems: 'center' }}>
                            <Text variant="label" style={{ width: 28 }}>{p.seed}</Text>
                            <Text variant="body" style={{ flex: 1 }}>{p.name}</Text>
                            <Text variant="caption">{p.country}</Text>
                        </View>
                    ))}
                </Card>

                <Text variant="caption" style={{ marginTop: 24, textAlign: 'center' }}>id: {id}</Text>
            </ScrollView>
        </Screen>
    )
}
