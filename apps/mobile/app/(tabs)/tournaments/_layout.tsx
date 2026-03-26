import { Stack } from 'expo-router'
import { useTheme } from '../../../theme'

export default function TournamentsLayout() {
    const { colors, fonts } = useTheme()

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: fonts.body.semiBold, fontSize: 17 },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Турниры' }} />
            <Stack.Screen name="[id]" options={{ title: 'Турнир' }} />
            <Stack.Screen name="rankings" options={{ title: 'Рейтинг' }} />
        </Stack>
    )
}
