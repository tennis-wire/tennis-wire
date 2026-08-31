import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display'
import {
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3'
import { Outfit_700Bold } from '@expo-google-fonts/outfit'
import {
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans'
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display'
import {
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans'

import { ThemeProvider, useTheme } from '../theme'

SplashScreen.preventAutoHideAsync()

// Inner component that has access to theme
function RootStack() {
    const { colors, isDark } = useTheme()

    return (
        <>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                    name="sections/[slug]"
                    options={{ headerShown: true, title: 'Раздел' }}
                />
                <Stack.Screen name="tags/[slug]" options={{ headerShown: true, title: 'Тег' }} />
                <Stack.Screen
                    name="players/[slug]"
                    options={{ headerShown: true, title: 'Игрок' }}
                />
            </Stack>
        </>
    )
}

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        // Editorial Classic
        DMSerifDisplay_400Regular,
        SourceSans3_400Regular,
        SourceSans3_600SemiBold,
        SourceSans3_700Bold,
        // Modern Bold
        Outfit_700Bold,
        IBMPlexSans_400Regular,
        IBMPlexSans_600SemiBold,
        IBMPlexSans_700Bold,
        // Magazine Luxe
        PlayfairDisplay_700Bold,
        NunitoSans_400Regular,
        NunitoSans_600SemiBold,
        NunitoSans_700Bold,
    })

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync()
        }
    }, [fontsLoaded])

    if (!fontsLoaded) return null

    return (
        <ThemeProvider>
            <RootStack />
        </ThemeProvider>
    )
}
