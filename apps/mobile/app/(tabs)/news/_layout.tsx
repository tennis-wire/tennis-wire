import { Stack } from 'expo-router'
import { useTheme } from '../../../theme'

export default function NewsLayout() {
    const { colors, fonts } = useTheme()

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: fonts.body.semiBold, fontSize: 17 },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Новости' }} />
            <Stack.Screen name="[slug]" options={{ title: '' }} />
        </Stack>
    )
}
