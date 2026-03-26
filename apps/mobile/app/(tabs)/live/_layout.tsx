import { Stack } from 'expo-router'
import { useTheme } from '../../../theme'

export default function LiveLayout() {
    const { colors, fonts } = useTheme()

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: fonts.body.semiBold, fontSize: 17 },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Live' }} />
            <Stack.Screen name="[id]" options={{ title: 'Матч' }} />
        </Stack>
    )
}
