import { ScrollView, View, FlatList, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../theme'
import { Text, Card, Tag, LiveBadge, Divider, Screen } from '../../components/ui'

// ─── Mock data (matches public-web/components/home/*) ────────

const LIVE_MATCHES = [
    { id: '1', p1: 'Синнер', p2: 'Алькарас', score: '6-4 3-2', set: '2-й сет' },
    { id: '2', p1: 'Рублёв', p2: 'Джокович', score: '2-6 5-4', set: '2-й сет' },
    { id: '3', p1: 'Соболенко', p2: 'Швёнтек', score: '6-3 1-0', set: '2-й сет' },
]

const HERO = {
    slug: 'sinner-wins-miami',
    title: 'Синнер выиграл Miami Open, обыграв Алькараса в трёх сетах',
    summary: 'Итальянец подтвердил статус первой ракетки мира уверенной победой на Мастерсе.',
    source: 'ATP Tour',
    time: '2 ч назад',
}

const NEWS = [
    { slug: 'rublev-injury', title: 'Рублёв снялся с турнира в Мадриде из-за травмы запястья', time: '4 ч назад' },
    { slug: 'wta-rankings', title: 'Швёнтек вернула первую строчку рейтинга WTA', time: '5 ч назад' },
    { slug: 'medvedev-coach', title: 'Медведев объявил о смене тренера перед грунтовым сезоном', time: '6 ч назад' },
    { slug: 'roland-garros-seeds', title: 'Roland Garros: стали известны первые сеяные', time: '8 ч назад' },
]

const MATERIALS = [
    { slug: 'sinner-season', title: 'Сезон Синнера: как итальянец стал доминирующей силой', tag: 'Аналитика' },
    { slug: 'next-gen-2026', title: 'Next Gen: кто из молодых готов ворваться в топ-10', tag: 'Обзор' },
    { slug: 'clay-preview', title: 'Превью грунтового сезона: фавориты и тёмные лошадки', tag: 'Превью' },
]

// ─── Sections ────────────────────────────────────────────────

function LiveTicker() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <View style={{ backgroundColor: colors.surface, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 }}>
                <LiveBadge />
                <Text variant="label" style={{ marginLeft: 8 }}>Сейчас играют</Text>
            </View>
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12 }}
                data={LIVE_MATCHES}
                keyExtractor={(m) => m.id}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => router.push(`/live/${item.id}`)}
                        style={{
                            backgroundColor: colors.bgAlt,
                            borderRadius: 10,
                            padding: 12,
                            marginHorizontal: 4,
                            minWidth: 160,
                        }}
                    >
                        <Text variant="bodySmall" numberOfLines={1}>{item.p1}</Text>
                        <Text variant="h3" style={{ marginVertical: 2 }}>{item.score}</Text>
                        <Text variant="bodySmall" numberOfLines={1}>{item.p2}</Text>
                        <Text variant="caption" style={{ marginTop: 4 }}>{item.set}</Text>
                    </Pressable>
                )}
            />
        </View>
    )
}

function HeroNews() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <Card onPress={() => router.push(`/news/${HERO.slug}`)} style={{ margin: 16, marginBottom: 8 }}>
            {/* Cover placeholder */}
            <View style={{ height: 180, backgroundColor: colors.bgAlt, justifyContent: 'center', alignItems: 'center' }}>
                <Text variant="caption">Фото обложки</Text>
            </View>
            <View style={{ padding: 14 }}>
                <Text variant="h2" numberOfLines={3}>{HERO.title}</Text>
                <Text variant="body" style={{ marginTop: 6 }} numberOfLines={2}>{HERO.summary}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text variant="caption">{HERO.source}</Text>
                    <Text variant="caption">{HERO.time}</Text>
                </View>
            </View>
        </Card>
    )
}

function NewsFeed() {
    const router = useRouter()

    return (
        <View style={{ paddingHorizontal: 16 }}>
            <Text variant="h2" style={{ marginBottom: 12 }}>Последние новости</Text>
            {NEWS.map((item, i) => (
                <View key={item.slug}>
                    <Pressable onPress={() => router.push(`/news/${item.slug}`)} style={{ paddingVertical: 12 }}>
                        <Text variant="h3" numberOfLines={2}>{item.title}</Text>
                        <Text variant="caption" style={{ marginTop: 4 }}>{item.time}</Text>
                    </Pressable>
                    {i < NEWS.length - 1 && <Divider />}
                </View>
            ))}
        </View>
    )
}

function MaterialsList() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text variant="h2" style={{ marginBottom: 12 }}>Материалы</Text>
            {MATERIALS.map((item) => (
                <Card key={item.slug} onPress={() => router.push(`/more/material-detail?slug=${item.slug}` as any)} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row' }}>
                        <View style={{ width: 100, height: 80, backgroundColor: colors.bgAlt, justifyContent: 'center', alignItems: 'center' }}>
                            <Text variant="caption">Обложка</Text>
                        </View>
                        <View style={{ flex: 1, padding: 10 }}>
                            <Tag label={item.tag} />
                            <Text variant="h3" numberOfLines={2} style={{ marginTop: 6 }}>{item.title}</Text>
                        </View>
                    </View>
                </Card>
            ))}
        </View>
    )
}

// ─── Screen ──────────────────────────────────────────────────

export default function HomeScreen() {
    return (
        <Screen>
            <ScrollView showsVerticalScrollIndicator={false}>
                <LiveTicker />
                <HeroNews />
                <NewsFeed />
                <MaterialsList />
                <View style={{ height: 40 }} />
            </ScrollView>
        </Screen>
    )
}
