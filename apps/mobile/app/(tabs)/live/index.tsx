import { SectionList, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Card, LiveBadge, Screen } from '../../../components/ui'

interface Match {
    id: string
    p1: string
    p2: string
    score: string
    status: 'live' | 'upcoming' | 'finished'
    time?: string
    round?: string
}

const SECTIONS: { title: string; data: Match[] }[] = [
  {
    title: 'Сейчас играют',
    data: [
      { id: '1', p1: 'Синнер Я.', p2: 'Алькарас К.', score: '6-4 3-2', status: 'live', round: 'Финал' },
      { id: '2', p1: 'Рублёв А.', p2: 'Джокович Н.', score: '2-6 5-4', status: 'live', round: '1/2 финала' },
    ],
  },
  {
    title: 'Скоро начнутся',
    data: [
      { id: '3', p1: 'Соболенко А.', p2: 'Швёнтек И.', score: '—', status: 'upcoming', time: '18:00' },
      { id: '4', p1: 'Медведев Д.', p2: 'Циципас С.', score: '—', status: 'upcoming', time: '20:00' },
    ],
  },
  {
    title: 'Завершены',
    data: [
      { id: '5', p1: 'Хачанов К.', p2: 'Руне Х.', score: '6-3 6-7 7-5', status: 'finished' },
      { id: '6', p1: 'Пегула Дж.', p2: 'Гофф К.', score: '6-4 6-2', status: 'finished' },
    ],
  },
]

function MatchCard({ match }: { match: Match }) {
    const router = useRouter()

    return (
        <Card onPress={() => router.push(`/live/${match.id}`)} style={{ marginHorizontal: 16, marginVertical: 4 }}>
            <View style={{ padding: 14 }}>
                {match.round && <Text variant="caption" style={{ marginBottom: 6 }}>{match.round}</Text>}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Text variant="h3">{match.p1}</Text>
                        <Text variant="h3" style={{ marginTop: 4 }}>{match.p2}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        {match.status === 'live' && <LiveBadge />}
                        <Text variant="h2" style={{ marginTop: match.status === 'live' ? 6 : 0 }}>{match.score}</Text>
                        {match.time && <Text variant="caption" style={{ marginTop: 4 }}>{match.time}</Text>}
                    </View>
                </View>
            </View>
        </Card>
    )
}

export default function LiveScreen() {
    const { colors } = useTheme()

    return (
        <Screen>
            <SectionList
                sections={SECTIONS}
                keyExtractor={(item) => item.id}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderSectionHeader={({ section }) => (
                    <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, backgroundColor: colors.bg }}>
                        <Text variant="h2">{section.title}</Text>
                    </View>
                )}
                renderItem={({ item }) => <MatchCard match={item} />}
            />
        </Screen>
    )
}
