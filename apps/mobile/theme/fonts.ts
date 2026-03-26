/**
 * Tennis Wire Mobile — Шрифтовые пары
 * Синхронизировано с public-web/theme/fonts.ts
 *
 * Web uses CSS font-family strings + Google Fonts URLs.
 * Mobile uses expo-google-fonts package export names.
 * Same 3 pairs, same names.
 */

export interface FontPairMobile {
    key: string
    name: string
    description: string
    /** Font names as exported from @expo-google-fonts/* */
    display: {
        regular: string
    }
    body: {
        regular: string
        semiBold: string
        bold: string
    }
}

export type FontPairKey = 'editorialClassic' | 'modernBold' | 'magazineLuxe'

export const FONT_PAIRS: Record<FontPairKey, FontPairMobile> = {
    editorialClassic: {
        key: 'editorialClassic',
        name: 'Editorial Classic',
        description: 'Классика спортивной журналистики.',
        display: {
            regular: 'DMSerifDisplay_400Regular',
        },
        body: {
            regular: 'SourceSans3_400Regular',
            semiBold: 'SourceSans3_600SemiBold',
            bold: 'SourceSans3_700Bold',
        },
    },
    modernBold: {
        key: 'modernBold',
        name: 'Modern Bold',
        description: 'Современный, технологичный.',
        display: {
            regular: 'Outfit_700Bold',
        },
        body: {
            regular: 'IBMPlexSans_400Regular',
            semiBold: 'IBMPlexSans_600SemiBold',
            bold: 'IBMPlexSans_700Bold',
        },
    },
    magazineLuxe: {
        key: 'magazineLuxe',
        name: 'Magazine Luxe',
        description: 'Журнальный роскошный стиль.',
        display: {
            regular: 'PlayfairDisplay_700Bold',
        },
        body: {
            regular: 'NunitoSans_400Regular',
            semiBold: 'NunitoSans_600SemiBold',
            bold: 'NunitoSans_700Bold',
        },
    },
}
