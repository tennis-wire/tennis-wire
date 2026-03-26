import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Tag, Screen } from '../../../components/ui'

export default function NewsDetailScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>()
    const { colors } = useTheme()

    return (
        <Screen>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text variant="caption" style={{ marginBottom: 8 }}>ATP Tour · 2 ч назад</Text>
                <Text variant="display">Синнер выиграл Miami Open, обыграв Алькараса в трёх сетах</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 20 }}>
                    <Tag label="Синнер" />
                    <Tag label="Алькарас" />
                    <Tag label="Miami Open" />
                </View>

                {/* Cover placeholder */}
                <View style={{ height: 200, backgroundColor: colors.bgAlt, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <Text variant="caption">Фото</Text>
                </View>

                <Text variant="body" style={{ marginBottom: 12 }}>
                    Янник Синнер одержал убедительную победу над Карлосом Алькарасом в финале Miami Open
                    со счётом 6-4, 3-6, 6-3, подтвердив свой статус первой ракетки мира.
                </Text>
                <Text variant="body" style={{ marginBottom: 12 }}>
                    Итальянец продемонстрировал великолепную игру на задней линии, выигрывая ключевые розыгрыши
                    в решающие моменты матча. Это его третий титул Masters 1000 в сезоне.
                </Text>
                <Text variant="body">
                    «Это был невероятный матч. Карлос — великий соперник, и каждый раз наши встречи
                    выходят на новый уровень», — сказал Синнер после победы.
                </Text>

                <Text variant="caption" style={{ marginTop: 24 }}>slug: {slug}</Text>
            </ScrollView>
        </Screen>
    )
}
