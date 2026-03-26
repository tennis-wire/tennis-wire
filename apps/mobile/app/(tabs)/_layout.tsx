import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export default function TabLayout() {
    const { colors, fonts } = useTheme()

    const tabBarStyle = {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
    }

    const headerStyle = {
        backgroundColor: colors.surface,
    }

    return (
        <Tabs
            screenOptions={{
                headerStyle,
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: fonts.body.semiBold, fontSize: 17 },
                tabBarStyle,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: { fontFamily: fonts.body.semiBold, fontSize: 10 },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Главная',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="news"
                options={{
                    headerShown: false,
                    title: 'Новости',
                    tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="live"
                options={{
                    headerShown: false,
                    title: 'Live',
                    tabBarIcon: ({ color, size }) => <Ionicons name="radio" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="tournaments"
                options={{
                    headerShown: false,
                    title: 'Турниры',
                    tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    headerShown: false,
                    title: 'Ещё',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="ellipsis-horizontal" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    )
}
