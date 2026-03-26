import { Stack } from 'expo-router'
import { useTheme } from '../../../theme'

export default function MoreLayout() {
    const { colors, fonts } = useTheme()

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: fonts.body.semiBold, fontSize: 17 },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Ещё' }} />
            <Stack.Screen name="materials" options={{ title: 'Материалы' }} />
            <Stack.Screen name="material-detail" options={{ title: '' }} />
            <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
        </Stack>
    )
}
