import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native'

import { useTheme } from '../theme'
import { Text, Card, Screen } from '../components/ui'
import { useReaderSession } from '../components/auth/ReaderSessionProvider'
import { updateDisplayName } from '../lib/gateway/client'
import { isValidNickname } from '../lib/auth/nickname'
import { strings } from '../components/discussion/strings'

function SignedOut() {
    const { colors } = useTheme()
    const { canLogin, login } = useReaderSession()
    const [pending, setPending] = useState(false)

    async function onPress() {
        setPending(true)
        try {
            await login()
        } finally {
            setPending(false)
        }
    }

    return (
        <View style={{ padding: 16, alignItems: 'center', gap: 16, paddingTop: 48 }}>
            <Text variant="h2">Личный кабинет</Text>
            <Text variant="body" style={{ textAlign: 'center' }}>
                Войдите, чтобы оставлять комментарии и настраивать профиль.
            </Text>
            <Card
                onPress={canLogin && !pending ? onPress : undefined}
                style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: colors.primary,
                    opacity: canLogin ? 1 : 0.5,
                }}
            >
                {pending ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text variant="h3" color="#fff">
                        Войти
                    </Text>
                )}
            </Card>
        </View>
    )
}

function NicknameField({ displayName, chosen }: { displayName: string; chosen: boolean }) {
    const { colors } = useTheme()
    const { accessToken, setSession, session } = useReaderSession()
    const [value, setValue] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [saving, setSaving] = useState(false)

    async function save() {
        if (!isValidNickname(value)) {
            setError('3–24 символа: латиница, цифры, дефис или подчёркивание')
            return
        }
        if (!accessToken) return
        setSaving(true)
        setError(null)
        setSaved(false)

        const result = await updateDisplayName(accessToken, value)
        setSaving(false)

        if (!result.ok) {
            setError(
                result.conflict
                    ? 'Такое имя уже занято'
                    : 'Не удалось сохранить, попробуйте ещё раз'
            )
            return
        }
        if (session?.authenticated) {
            setSession({
                authenticated: true,
                userId: result.profile.userId,
                displayName: result.profile.displayName,
                displayNameChosen: true,
                createdAt: result.profile.createdAt,
            })
        }
        setValue('')
        setSaved(true)
    }

    return (
        <Card style={{ padding: 16 }}>
            <Text variant="h3" style={{ marginBottom: 4 }}>
                Имя
            </Text>
            <Text variant="caption" style={{ marginBottom: 14 }}>
                {chosen
                    ? `Сейчас вас видят как ${displayName}.`
                    : `Сейчас у вас имя, выданное автоматически: ${displayName}. Под ним вас и видят в комментариях.`}
            </Text>
            <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="например, tennis_fan"
                placeholderTextColor={colors.textMuted}
                maxLength={24}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.text,
                    marginBottom: 10,
                }}
            />
            <Card
                onPress={!saving && value !== '' ? save : undefined}
                style={{
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor: colors.primary,
                    opacity: value === '' ? 0.5 : 1,
                }}
            >
                <Text variant="label" color="#fff">
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </Text>
            </Card>
            {error && (
                <Text variant="caption" color={colors.live} style={{ marginTop: 8 }}>
                    {error}
                </Text>
            )}
            {saved && (
                <Text variant="caption" style={{ marginTop: 8 }}>
                    Имя сохранено.
                </Text>
            )}
        </Card>
    )
}

function SignedIn({
    displayName,
    displayNameChosen,
}: {
    displayName: string | null
    displayNameChosen: boolean
}) {
    const { colors } = useTheme()
    const router = useRouter()
    const { logout } = useReaderSession()
    const [loggingOut, setLoggingOut] = useState(false)

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <NicknameField displayName={displayName ?? '…'} chosen={displayNameChosen} />
            <Card onPress={() => router.push('/me/ignore')} style={{ padding: 14 }}>
                <Text variant="h3">{strings.ignoreList}</Text>
            </Card>
            <Card
                onPress={
                    loggingOut
                        ? undefined
                        : async () => {
                              setLoggingOut(true)
                              await logout()
                          }
                }
                style={{ padding: 14, alignItems: 'center' }}
            >
                {loggingOut ? (
                    <ActivityIndicator color={colors.primary} />
                ) : (
                    <Text variant="h3" color={colors.live}>
                        Выйти
                    </Text>
                )}
            </Card>
        </ScrollView>
    )
}

export default function ProfileScreen() {
    const { session } = useReaderSession()

    return (
        <Screen>
            {!session ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                </View>
            ) : session.authenticated ? (
                <SignedIn
                    displayName={session.displayName}
                    displayNameChosen={session.displayNameChosen}
                />
            ) : (
                <SignedOut />
            )}
        </Screen>
    )
}
