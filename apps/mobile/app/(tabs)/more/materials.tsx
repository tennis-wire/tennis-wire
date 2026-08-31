import { FlatList, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Card, Tag, Screen } from '../../../components/ui'

const MATERIALS = [
    {
        slug: 'sinner-season',
        title: 'Сезон Синнера: как итальянец стал доминирующей силой',
        tag: 'Аналитика',
        time: '5 ч чтения',
    },
    {
        slug: 'next-gen-2026',
        title: 'Next Gen: кто из молодых готов ворваться в топ-10',
        tag: 'Обзор',
        time: '8 мин чтения',
    },
    {
        slug: 'clay-preview',
        title: 'Превью грунтового сезона: фавориты и тёмные лошадки',
        tag: 'Превью',
        time: '6 мин чтения',
    },
    {
        slug: 'djokovic-legacy',
        title: 'Наследие Джоковича: что останется после карьеры',
        tag: 'Эссе',
        time: '10 мин чтения',
    },
    {
        slug: 'wta-parity',
        title: 'Паритет в WTA: почему предсказать победительницу всё сложнее',
        tag: 'Аналитика',
        time: '7 мин чтения',
    },
]

export default function MaterialsScreen() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <Screen>
            <FlatList
                data={MATERIALS}
                keyExtractor={(i) => i.slug}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                renderItem={({ item }) => (
                    <Card
                        onPress={() =>
                            router.push({
                                pathname: '/more/material-detail',
                                params: { slug: item.slug },
                            })
                        }
                    >
                        <View style={{ flexDirection: 'row' }}>
                            {/* Cover placeholder */}
                            <View
                                style={{
                                    width: 110,
                                    height: 90,
                                    backgroundColor: colors.bgAlt,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text variant="caption">Обложка</Text>
                            </View>
                            <View style={{ flex: 1, padding: 12 }}>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                                    <Tag label={item.tag} />
                                </View>
                                <Text variant="h3" numberOfLines={2}>
                                    {item.title}
                                </Text>
                                <Text variant="caption" style={{ marginTop: 4 }}>
                                    {item.time}
                                </Text>
                            </View>
                        </View>
                    </Card>
                )}
            />
        </Screen>
    )
}
