export interface FontPair {
    key: string
    name: string
    display: string
    body: string
    description: string
}

export type FontPairKey = 'editorialClassic' | 'modernBold' | 'magazineLuxe'

// The families themselves are in faces.ts, each as a variable on <html>
export const FONT_PAIRS: Record<FontPairKey, FontPair> = {
    editorialClassic: {
        key: 'editorialClassic',
        name: 'Editorial Classic',
        display: 'var(--font-noto-serif-display)',
        body: 'var(--font-source-sans-3)',
        description: 'Классика спортивной журналистики.',
    },
    modernBold: {
        key: 'modernBold',
        name: 'Modern Bold',
        display: 'var(--font-manrope)',
        body: 'var(--font-ibm-plex-sans)',
        description: 'Современный, технологичный.',
    },
    magazineLuxe: {
        key: 'magazineLuxe',
        name: 'Magazine Luxe',
        display: 'var(--font-playfair-display)',
        body: 'var(--font-nunito-sans)',
        description: 'Журнальный роскошный стиль.',
    },
}
