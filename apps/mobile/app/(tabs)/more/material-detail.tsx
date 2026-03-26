import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../../theme'
import { Text, Tag, Screen } from '../../../components/ui'

export default function MaterialDetailScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>()
    const { colors } = useTheme()

    return (
        <Screen>
            <ScrollView>
                {/* Cover */}
                <View style={{ height: 220, backgroundColor: colors.bgAlt, justifyContent: 'center', alignItems: 'center' }}>
                    <Text variant="caption">Обложка материала</Text>
                </View>

                <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <Tag label="Аналитика" />
                        <Text variant="caption" style={{ alignSelf: 'center' }}>· 5 мин чтения</Text>
                    </View>

                    <Text variant="display">Сезон Синнера: как итальянец стал доминирующей силой</Text>

                    <Text variant="bodySmall" style={{ marginTop: 8 }}>
                        Подробный разбор того, как Янник Синнер прошёл путь от перспективного юниора
                        до бесспорного лидера мирового тенниса.
                    </Text>

                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

                    <Text variant="body" style={{ marginBottom: 12 }}>
                        Когда в начале 2024 года Янник Синнер впервые возглавил рейтинг ATP, многие
                        считали это временным явлением. Два года спустя итальянец доказал, что пришёл
                        надолго — и, возможно, навсегда изменил расстановку сил в мужском теннисе.
                    </Text>
                    <Text variant="body" style={{ marginBottom: 12 }}>
                        Его стиль игры — агрессивный бейслайн с невероятной стабильностью — стал
                        образцом для нового поколения. Синнер выигрывает не за счёт одного
                        доминирующего удара, а за счёт отсутствия слабых мест.
                    </Text>
                    <Text variant="body">
                        В этом материале мы разберём ключевые факторы его доминирования: от тактических
                        изменений до физической подготовки и ментальной устойчивости.
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
                        <Tag label="Синнер" />
                        <Tag label="ATP" />
                        <Tag label="Сезон 2026" />
                    </View>

                    <Text variant="caption" style={{ marginTop: 20 }}>slug: {slug}</Text>
                </View>
            </ScrollView>
        </Screen>
    )
}
