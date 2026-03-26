/**
 * Tennis Wire Mobile — Палитры
 * Синхронизировано с public-web/theme/palettes.ts
 *
 * Отличия от web-версии:
 * - cardShadow: опущен (в RN используем StyleSheet shadow props)
 * - Все остальные поля и цвета идентичны
 */

export interface PaletteColors {
    bg: string
    bgAlt: string
    surface: string
    primary: string
    primaryDark: string
    primaryLight: string
    accent: string
    accentSoft: string
    text: string
    textSecondary: string
    textMuted: string
    border: string
    live: string
    liveBg: string
    tag: string
}

export interface Palette {
    name: string
    description: string
    colors: PaletteColors
    darkColors: PaletteColors
}

export type PaletteKey = 'courtGreen' | 'deepNavy' | 'clayCourt'

export const PALETTES: Record<PaletteKey, Palette> = {
    courtGreen: {
        name: 'Court Green',
        description: 'Основана на зелени теннисного корта. Свежая, спортивная, живая.',
        colors: {
            bg: '#F7F5F0',
            bgAlt: '#EDEAE3',
            surface: '#FFFFFF',
            primary: '#1B6B3A',
            primaryDark: '#0F4D28',
            primaryLight: '#2D8E50',
            accent: '#E8A838',
            accentSoft: '#F5D78E',
            text: '#1A1A1A',
            textSecondary: '#5C5C5C',
            textMuted: '#8A8A8A',
            border: '#D9D5CC',
            live: '#DC2626',
            liveBg: '#FEF2F2',
            tag: '#EDF5F0',
        },
        darkColors: {
            bg: '#111111',
            bgAlt: '#1A1A1A',
            surface: '#222222',
            primary: '#3DA65E',
            primaryDark: '#2D8E50',
            primaryLight: '#5BBF78',
            accent: '#E8A838',
            accentSoft: '#5C4A1F',
            text: '#F0EDE6',
            textSecondary: '#A0A0A0',
            textMuted: '#666666',
            border: '#333333',
            live: '#EF4444',
            liveBg: '#2A1515',
            tag: '#1A2E20',
        },
    },
    deepNavy: {
        name: 'Deep Navy',
        description: 'Тёмно-синяя база, как хард-корт. Солидная, премиальная, серьёзная.',
        colors: {
            bg: '#F5F6FA',
            bgAlt: '#ECEEF5',
            surface: '#FFFFFF',
            primary: '#1E3A5F',
            primaryDark: '#132845',
            primaryLight: '#2B5490',
            accent: '#E25822',
            accentSoft: '#FADDD2',
            text: '#1A1A2E',
            textSecondary: '#555570',
            textMuted: '#8888A0',
            border: '#D5D7E2',
            live: '#DC2626',
            liveBg: '#FEF2F2',
            tag: '#EEF0F8',
        },
        darkColors: {
            bg: '#0C0F18',
            bgAlt: '#141825',
            surface: '#1C2030',
            primary: '#4A8BD4',
            primaryDark: '#3670B0',
            primaryLight: '#6AA4E8',
            accent: '#F07040',
            accentSoft: '#4A2518',
            text: '#E8EAF0',
            textSecondary: '#9098B0',
            textMuted: '#5A6080',
            border: '#2A3045',
            live: '#EF4444',
            liveBg: '#2A1515',
            tag: '#1A2040',
        },
    },
    clayCourt: {
        name: 'Clay Court',
        description: 'Тёплые терракотовые тона. Элегантная, европейская, как Roland Garros.',
        colors: {
            bg: '#FAF6F1',
            bgAlt: '#F0EAE0',
            surface: '#FFFFFF',
            primary: '#B8562B',
            primaryDark: '#8C3F1E',
            primaryLight: '#D4703F',
            accent: '#2D6B4A',
            accentSoft: '#D5E8DD',
            text: '#2C1810',
            textSecondary: '#6B5040',
            textMuted: '#9A8878',
            border: '#DDD5CA',
            live: '#DC2626',
            liveBg: '#FEF2F2',
            tag: '#F8F0E8',
        },
        darkColors: {
            bg: '#161210',
            bgAlt: '#201A16',
            surface: '#2A2220',
            primary: '#D4864A',
            primaryDark: '#B8562B',
            primaryLight: '#E8A070',
            accent: '#4CAF7A',
            accentSoft: '#1E3A2A',
            text: '#F0E8E0',
            textSecondary: '#A09080',
            textMuted: '#6A5A4A',
            border: '#3A3230',
            live: '#EF4444',
            liveBg: '#2A1515',
            tag: '#2E2420',
        },
    },
}
