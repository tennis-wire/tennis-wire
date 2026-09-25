'use client'

import { useState } from 'react'

import { useTheme, PALETTES, FONT_PAIRS } from '@/theme'
import type { PaletteKey, FontPairKey, ThemeMode } from '@/theme'

const MODES: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Системная' },
    { value: 'light', label: 'Светлая' },
    { value: 'dark', label: 'Тёмная' },
]

type Row = 'palette' | 'fonts'

const card: React.CSSProperties = {
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 12,
}

const label: React.CSSProperties = { fontSize: 15, fontWeight: 600 }

const note: React.CSSProperties = { fontSize: 13, color: 'var(--tw-text-secondary)' }

const segment = (chosen: boolean): React.CSSProperties => ({
    fontSize: 14,
    padding: '7px 14px',
    border: 'none',
    borderRadius: 7,
    background: chosen ? 'var(--tw-surface)' : 'transparent',
    color: chosen ? 'var(--tw-text)' : 'var(--tw-text-secondary)',
    fontWeight: chosen ? 600 : 400,
    boxShadow: chosen ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
    cursor: 'pointer',
})

const choice = (chosen: boolean): React.CSSProperties => ({
    fontSize: 14,
    color: 'var(--tw-text)',
    fontWeight: chosen ? 600 : 400,
    borderRadius: 9,
    border: chosen ? '2px solid var(--tw-primary)' : '1px solid var(--tw-border)',
    background: chosen ? 'var(--tw-tag)' : 'var(--tw-surface)',
    cursor: 'pointer',
    textAlign: 'left',
})

const dot = (color: string, overlap: boolean): React.CSSProperties => ({
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: color,
    marginLeft: overlap ? -5 : 0,
})

// Three rows, each with its value on the right. The theme is short enough to set in place; the
// palette and the font open under their row, one at a time.
export default function AppearancePage() {
    const { palette, fontPair, mode, isDark, setPalette, setFontPair, setMode } = useTheme()
    const [open, setOpen] = useState<Row | null>(null)
    const toggle = (row: Row) => setOpen(open === row ? null : row)

    return (
        <div>
            <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Внешний вид</h1>
            <p style={{ color: 'var(--tw-text-secondary)', fontSize: 14, margin: '0 0 20px' }}>
                Настройки хранятся в этом браузере и работают без входа.
            </p>

            <div style={card}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                        padding: '14px 16px',
                    }}
                >
                    <span style={label}>Тема</span>
                    <span style={{ flex: 1 }} />
                    <div
                        role="group"
                        aria-label="Тема"
                        style={{
                            display: 'flex',
                            gap: 2,
                            padding: 2,
                            borderRadius: 9,
                            background: 'var(--tw-bg-alt)',
                        }}
                    >
                        {MODES.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={mode === option.value}
                                onClick={() => setMode(option.value)}
                                style={segment(mode === option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <Expander
                    title="Палитра"
                    value={PALETTES[palette].name}
                    open={open === 'palette'}
                    onToggle={() => toggle('palette')}
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
                            const p = PALETTES[key]
                            // what the palette looks like in the mode the reader is in now
                            const colors = isDark ? p.darkColors : p.colors
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={palette === key}
                                    onClick={() => setPalette(key)}
                                    style={{
                                        ...choice(palette === key),
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '7px 10px 7px 8px',
                                    }}
                                >
                                    <span aria-hidden style={{ display: 'flex', flexShrink: 0 }}>
                                        <span style={dot(colors.primary, false)} />
                                        <span style={dot(colors.accent, true)} />
                                    </span>
                                    {p.name}
                                </button>
                            )
                        })}
                    </div>
                    <p style={{ ...note, margin: '10px 0 0' }}>{PALETTES[palette].description}</p>
                </Expander>

                <Expander
                    title="Шрифт"
                    value={FONT_PAIRS[fontPair].name}
                    open={open === 'fonts'}
                    onToggle={() => toggle('fonts')}
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        {(Object.keys(FONT_PAIRS) as FontPairKey[]).map((key) => {
                            const f = FONT_PAIRS[key]
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={fontPair === key}
                                    onClick={() => setFontPair(key)}
                                    style={{
                                        ...choice(fontPair === key),
                                        flex: '1 1 150px',
                                        minWidth: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        gap: 4,
                                        padding: '10px 12px',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: f.display,
                                            fontSize: 19,
                                            lineHeight: 1.1,
                                        }}
                                    >
                                        {f.name}
                                    </span>
                                    <span style={{ ...note, fontFamily: f.body, fontWeight: 400 }}>
                                        {f.description}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </Expander>
            </div>
        </div>
    )
}

function Expander({
    title,
    value,
    open,
    onToggle,
    children,
}: {
    title: string
    value: string
    open: boolean
    onToggle: () => void
    children: React.ReactNode
}) {
    return (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--tw-border)' }}>
            <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: 'var(--tw-text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                }}
            >
                <span style={label}>{title}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 14, color: 'var(--tw-text-secondary)' }}>{value}</span>
                <span aria-hidden style={{ fontSize: 13, color: 'var(--tw-text-muted)' }}>
                    {open ? '\u25B4' : '\u25BE'}
                </span>
            </button>
            {open && children}
        </div>
    )
}
