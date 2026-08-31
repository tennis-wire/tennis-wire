import React from 'react'
import {
    Text as RNText,
    View,
    Pressable,
    StyleSheet,
    type TextProps,
    type ViewProps,
} from 'react-native'
import { useTheme } from '../theme'

// ─── Typography ──────────────────────────────────────────────

interface TTextProps extends TextProps {
    variant?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label'
    color?: string
}

export function Text({ variant = 'body', color, style, ...props }: TTextProps) {
    const { colors, fonts } = useTheme()

    const variantStyle = (() => {
        switch (variant) {
            case 'display':
                return {
                    fontFamily: fonts.display.regular,
                    fontSize: 28,
                    lineHeight: 34,
                    color: colors.text,
                }
            case 'h1':
                return {
                    fontFamily: fonts.display.regular,
                    fontSize: 24,
                    lineHeight: 30,
                    color: colors.text,
                }
            case 'h2':
                return {
                    fontFamily: fonts.body.bold,
                    fontSize: 20,
                    lineHeight: 26,
                    color: colors.text,
                }
            case 'h3':
                return {
                    fontFamily: fonts.body.semiBold,
                    fontSize: 17,
                    lineHeight: 22,
                    color: colors.text,
                }
            case 'body':
                return {
                    fontFamily: fonts.body.regular,
                    fontSize: 15,
                    lineHeight: 22,
                    color: colors.text,
                }
            case 'bodySmall':
                return {
                    fontFamily: fonts.body.regular,
                    fontSize: 13,
                    lineHeight: 18,
                    color: colors.textSecondary,
                }
            case 'caption':
                return {
                    fontFamily: fonts.body.regular,
                    fontSize: 12,
                    lineHeight: 16,
                    color: colors.textMuted,
                }
            case 'label':
                return {
                    fontFamily: fonts.body.semiBold,
                    fontSize: 13,
                    lineHeight: 18,
                    color: colors.textSecondary,
                }
            default:
                return {
                    fontFamily: fonts.body.regular,
                    fontSize: 15,
                    lineHeight: 22,
                    color: colors.text,
                }
        }
    })()

    return <RNText style={[variantStyle, color ? { color } : undefined, style]} {...props} />
}

// ─── Card ────────────────────────────────────────────────────

interface CardProps extends ViewProps {
    onPress?: () => void
}

export function Card({ onPress, style, children, ...props }: CardProps) {
    const { colors } = useTheme()

    const cardStyle = {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        overflow: 'hidden' as const,
    }

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [cardStyle, pressed && { opacity: 0.7 }, style]}
                {...props}
            >
                {children}
            </Pressable>
        )
    }

    return (
        <View style={[cardStyle, style]} {...props}>
            {children}
        </View>
    )
}

// ─── Tag ─────────────────────────────────────────────────────

interface TagProps {
    label: string
    onPress?: () => void
}

export function Tag({ label, onPress }: TagProps) {
    const { colors, fonts } = useTheme()

    const tagView = (
        <View
            style={{
                backgroundColor: colors.tag,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
            }}
        >
            <RNText
                style={{ fontFamily: fonts.body.semiBold, fontSize: 12, color: colors.primary }}
            >
                {label}
            </RNText>
        </View>
    )

    return onPress ? <Pressable onPress={onPress}>{tagView}</Pressable> : tagView
}

// ─── LiveBadge ───────────────────────────────────────────────

export function LiveBadge() {
    const { colors, fonts } = useTheme()

    return (
        <View
            style={{
                backgroundColor: colors.live,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
            }}
        >
            <RNText
                style={{
                    fontFamily: fonts.body.bold,
                    fontSize: 11,
                    color: '#FFFFFF',
                    letterSpacing: 0.5,
                }}
            >
                LIVE
            </RNText>
        </View>
    )
}

// ─── Divider ─────────────────────────────────────────────────

export function Divider({ style }: { style?: ViewProps['style'] }) {
    const { colors } = useTheme()
    return (
        <View
            style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]}
        />
    )
}

// ─── Screen ──────────────────────────────────────────────────

export function Screen({ children, style, ...props }: ViewProps) {
    const { colors } = useTheme()
    return (
        <View style={[{ flex: 1, backgroundColor: colors.bg }, style]} {...props}>
            {children}
        </View>
    )
}
