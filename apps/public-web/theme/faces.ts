import {
    IBM_Plex_Sans,
    Manrope,
    Noto_Serif_Display,
    Nunito_Sans,
    Playfair_Display,
    Source_Sans_3,
} from 'next/font/google'

// Downloaded at build time and served from this site. Only the default pair is preloaded;
// the other families load when a reader picks their pair.
const notoSerifDisplay = Noto_Serif_Display({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-noto-serif-display',
    fallback: ['serif'],
})

const sourceSans3 = Source_Sans_3({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-source-sans-3',
    fallback: ['sans-serif'],
})

const manrope = Manrope({
    preload: false,
    variable: '--font-manrope',
    fallback: ['sans-serif'],
})

const ibmPlexSans = IBM_Plex_Sans({
    preload: false,
    variable: '--font-ibm-plex-sans',
    fallback: ['sans-serif'],
})

const playfairDisplay = Playfair_Display({
    preload: false,
    variable: '--font-playfair-display',
    fallback: ['serif'],
})

const nunitoSans = Nunito_Sans({
    preload: false,
    variable: '--font-nunito-sans',
    fallback: ['sans-serif'],
})

export const fontVariables = [
    notoSerifDisplay,
    sourceSans3,
    manrope,
    ibmPlexSans,
    playfairDisplay,
    nunitoSans,
]
    .map((face) => face.variable)
    .join(' ')
