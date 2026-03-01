import { createTheme } from '@mui/material'
import type { PaletteColors } from './palettes'
import type { FontPair } from './fonts'

export function createAppTheme(colors: PaletteColors, fontPair: FontPair, isDark: boolean) {
    return createTheme({
        palette: {
            mode: isDark ? 'dark' : 'light',
            primary: {
                main: colors.primary,
                dark: colors.primaryDark,
                light: colors.primaryLight,
            },
            secondary: {
                main: colors.accent,
            },
            error: {
                main: colors.live,
            },
            background: {
                default: colors.bg,
                paper: colors.surface,
            },
            text: {
                primary: colors.text,
                secondary: colors.textSecondary,
                disabled: colors.textMuted,
            },
            divider: colors.border,
        },
        typography: {
            fontFamily: fontPair.body,
            h1: { fontFamily: fontPair.display },
            h2: { fontFamily: fontPair.display },
            h3: { fontFamily: fontPair.display },
            h4: { fontFamily: fontPair.display },
            h5: { fontFamily: fontPair.display },
            h6: { fontFamily: fontPair.display },
        },
        shape: {
            borderRadius: 10,
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        fontFamily: fontPair.body,
                        transition: 'background-color 0.3s ease, color 0.3s ease',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        boxShadow: colors.cardShadow,
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        fontFamily: fontPair.body,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: 8,
                    },
                    contained: {
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: 'none',
                        },
                    },
                    outlined: {
                        borderColor: colors.border,
                    },
                },
            },
            MuiToggleButton: {
                styleOverrides: {
                    root: {
                        borderColor: colors.border,
                        color: colors.textSecondary,
                        '&.Mui-selected': {
                            backgroundColor: `${colors.primary}14`,
                            color: colors.primary,
                            borderColor: colors.primary,
                            '&:hover': {
                                backgroundColor: `${colors.primary}20`,
                            },
                        },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        color: colors.textSecondary,
                        '&:hover': {
                            backgroundColor: `${colors.primary}0A`,
                        },
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    indicator: {
                        backgroundColor: colors.primary,
                        height: 3,
                        borderRadius: '3px 3px 0 0',
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        fontFamily: fontPair.body,
                        textTransform: 'none',
                        fontWeight: 500,
                        color: colors.textSecondary,
                        '&.Mui-selected': {
                            color: colors.primary,
                            fontWeight: 600,
                        },
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            fontFamily: fontPair.body,
                            '& fieldset': {
                                borderColor: colors.border,
                            },
                            '&:hover fieldset': {
                                borderColor: colors.primaryLight,
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: colors.primary,
                            },
                        },
                        '& .MuiInputLabel-root': {
                            fontFamily: fontPair.body,
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontFamily: fontPair.body,
                        fontWeight: 500,
                    },
                    filled: {
                        backgroundColor: colors.tag,
                        color: colors.primary,
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        fontFamily: fontPair.body,
                        fontSize: '0.75rem',
                        backgroundColor: isDark ? colors.surface : colors.text,
                        color: isDark ? colors.text : colors.bg,
                        border: isDark ? `1px solid ${colors.border}` : 'none',
                        borderRadius: 6,
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        backgroundColor: colors.surface,
                        borderRadius: 14,
                        boxShadow: colors.cardShadow,
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        fontFamily: fontPair.body,
                        borderRadius: 10,
                    },
                },
            },
            MuiSelect: {
                styleOverrides: {
                    root: {
                        fontFamily: fontPair.body,
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        fontFamily: fontPair.body,
                    },
                },
            },
        },
    })
}
