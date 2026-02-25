import React, { useState } from 'react'
import {
    Box,
    IconButton,
    Tooltip,
    Popover,
    Typography,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material'
import { Palette, DarkMode, LightMode } from '@mui/icons-material'
import { useAppTheme } from './useAppTheme'
import { PALETTES, type PaletteKey } from './palettes'
import { FONT_PAIRS, type FontPairIndex } from './fonts'

const paletteKeys: PaletteKey[] = ['courtGreen', 'deepNavy', 'clayCourt']

const PalettePreview: React.FC<{ paletteKey: PaletteKey; isDark: boolean }> = ({
    paletteKey,
    isDark,
}) => {
    const pal = PALETTES[paletteKey]
    const c = isDark ? pal.darkColors : pal.colors
    return (
        <Box sx={{ display: 'flex', gap: '3px' }}>
            {[c.primary, c.accent, c.bg].map((color, i) => (
                <Box
                    key={i}
                    sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '3px',
                        backgroundColor: color,
                        border: '1px solid rgba(0,0,0,0.1)',
                    }}
                />
            ))}
        </Box>
    )
}

export const ThemeSwitcher: React.FC = () => {
    const { paletteKey, fontIndex, isDark, setPalette, setFontIndex, toggleDark, colors } =
        useAppTheme()
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

    const open = Boolean(anchorEl)

    return (
        <>
            <Tooltip title="Настройки темы">
                <IconButton
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    sx={{
                        backgroundColor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        width: 40,
                        height: 40,
                        boxShadow: colors.cardShadow,
                        '&:hover': {
                            backgroundColor: colors.bgAlt,
                        },
                    }}
                >
                    <Palette sx={{ fontSize: 20, color: colors.primary }} />
                </IconButton>
            </Tooltip>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            p: 2.5,
                            width: 280,
                            borderRadius: '14px',
                            backgroundColor: colors.surface,
                            border: `1px solid ${colors.border}`,
                            boxShadow: colors.cardShadow,
                        },
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 700,
                            fontFamily: 'var(--tw-font-display)',
                            color: colors.text,
                        }}
                    >
                        🎨 Тема оформления
                    </Typography>
                    <Tooltip title={isDark ? 'Светлая тема' : 'Тёмная тема'}>
                        <IconButton
                            size="small"
                            onClick={toggleDark}
                            sx={{
                                backgroundColor: colors.bgAlt,
                                border: `1px solid ${colors.border}`,
                                borderRadius: '8px',
                                width: 32,
                                height: 32,
                            }}
                        >
                            {isDark ? (
                                <LightMode sx={{ fontSize: 16, color: colors.accent }} />
                            ) : (
                                <DarkMode sx={{ fontSize: 16, color: colors.textSecondary }} />
                            )}
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Palettes */}
                <Typography
                    sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        color: colors.textMuted,
                        mb: 1,
                    }}
                >
                    Палитра
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
                    {paletteKeys.map((key) => {
                        const pal = PALETTES[key]
                        const isActive = paletteKey === key
                        return (
                            <Box
                                key={key}
                                onClick={() => setPalette(key)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    border: isActive
                                        ? `2px solid ${colors.primary}`
                                        : `1px solid ${colors.border}`,
                                    backgroundColor: isActive
                                        ? `${colors.primary}10`
                                        : 'transparent',
                                    transition: 'all 0.15s ease',
                                    '&:hover': {
                                        backgroundColor: isActive
                                            ? `${colors.primary}10`
                                            : colors.bgAlt,
                                    },
                                }}
                            >
                                <PalettePreview paletteKey={key} isDark={isDark} />
                                <Typography
                                    sx={{
                                        fontSize: 13,
                                        fontWeight: isActive ? 600 : 400,
                                        color: colors.text,
                                    }}
                                >
                                    {pal.name}
                                </Typography>
                            </Box>
                        )
                    })}
                </Box>

                {/* Fonts */}
                <Typography
                    sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        color: colors.textMuted,
                        mb: 1,
                    }}
                >
                    Шрифты
                </Typography>
                <ToggleButtonGroup
                    value={fontIndex}
                    exclusive
                    onChange={(_, v) => {
                        if (v !== null) setFontIndex(v as FontPairIndex)
                    }}
                    fullWidth
                    size="small"
                    sx={{
                        '& .MuiToggleButton-root': {
                            fontSize: 11,
                            fontWeight: 500,
                            py: 0.75,
                            textTransform: 'none',
                            borderColor: colors.border,
                            color: colors.textSecondary,
                            '&.Mui-selected': {
                                backgroundColor: `${colors.primary}14`,
                                color: colors.primary,
                                borderColor: colors.primary,
                                fontWeight: 600,
                            },
                        },
                    }}
                >
                    {FONT_PAIRS.map((fp, i) => (
                        <ToggleButton key={i} value={i}>
                            {fp.name}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                {/* Current info */}
                <Typography
                    sx={{
                        mt: 1.5,
                        fontSize: 11,
                        color: colors.textMuted,
                        lineHeight: 1.4,
                    }}
                >
                    {PALETTES[paletteKey].description}
                </Typography>
            </Popover>
        </>
    )
}
