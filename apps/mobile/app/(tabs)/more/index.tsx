import { View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../theme'
import { Text, Divider, Screen } from '../../../components/ui'

interface MenuItem {
    label: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    route: string
    description?: string
}

const MENU: MenuItem[] = [
    {
        label: 'Материалы',
        icon: 'document-text',
        route: '/more/materials',
        description: 'Аналитика, обзоры, интервью',
    },
    {
        label: 'Треш-зона',
        icon: 'flame',
        route: '/sections/trash',
        description: 'Скандалы, мемы, кринж',
    },
    {
        label: 'Настройки',
        icon: 'settings-outline',
        route: '/more/settings',
        description: 'Тема, палитра, шрифт',
    },
]

export default function MoreScreen() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <Screen>
            <View style={{ padding: 16 }}>
                {MENU.map((item, i) => (
                    <View key={item.route}>
                        <Pressable
                            onPress={() => router.push(item.route as any)}
                            style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 16,
                                opacity: pressed ? 0.6 : 1,
                            })}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    backgroundColor: colors.bgAlt,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 14,
                                }}
                            >
                                <Ionicons name={item.icon} size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text variant="h3">{item.label}</Text>
                                {item.description && (
                                    <Text variant="caption" style={{ marginTop: 2 }}>
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </Pressable>
                        {i < MENU.length - 1 && <Divider />}
                    </View>
                ))}
            </View>
        </Screen>
    )
}
