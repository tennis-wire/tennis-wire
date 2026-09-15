'use client'

import { useTheme, PALETTES, FONT_PAIRS } from '@/theme'
import type { PaletteKey, FontPairKey, ThemeMode } from '@/theme'

const MODES: { value: ThemeMode; label: string; icon: string; hint: string }[] = [
    { value: 'light', label: 'Светлая', icon: '☀️', hint: 'По умолчанию' },
    { value: 'dark', label: 'Тёмная', icon: '🌙', hint: 'Для вечерних матчей' },
    { value: 'system', label: 'Как в системе', icon: '🖥️', hint: 'Переключается сама' },
]

export default function CabinetPage() {
    const { palette, fontPair, mode, isDark, setPalette, setFontPair, setMode } = useTheme()

    return (
        <div style={{ maxWidth: 640 }}>
            <h1
                style={{
                    fontFamily: 'var(--tw-font-display)',
                    fontSize: 28,
                    marginBottom: 4,
                }}
            >
                Настройки
            </h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14, marginBottom: 32 }}>
                Внешний вид сайта. Настройки сохраняются в браузере.
            </p>

            {/* theme */}
            <section style={{ marginBottom: 32 }}>
                <h2
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 12,
                    }}
                >
                    Тема
                </h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    {MODES.map((option) => {
                        const isActive = mode === option.value

                        return (
                            <button
                                key={option.value}
                                onClick={() => setMode(option.value)}
                                style={{
                                    flex: 1,
                                    padding: '14px 16px',
                                    borderRadius: 12,
                                    border: isActive
                                        ? '2px solid var(--tw-primary)'
                                        : '1px solid var(--tw-border)',
                                    background: isActive ? 'var(--tw-tag)' : 'var(--tw-surface)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--tw-font-body)',
                                    fontSize: 14,
                                    color: 'var(--tw-text)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    textAlign: 'left',
                                }}
                            >
                                <span style={{ fontSize: 20 }}>{option.icon}</span>
                                <span>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontWeight: isActive ? 600 : 400,
                                        }}
                                    >
                                        {option.label}
                                    </span>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontSize: 12,
                                            color: 'var(--tw-text-muted)',
                                            marginTop: 2,
                                        }}
                                    >
                                        {option.hint}
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* palette */}
            <section style={{ marginBottom: 32 }}>
                <h2
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 12,
                    }}
                >
                    Палитра
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
                        const p = PALETTES[key]
                        const isActive = palette === key
                        const previewColors = isDark ? p.darkColors : p.colors

                        return (
                            <button
                                key={key}
                                onClick={() => setPalette(key)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    padding: '14px 16px',
                                    borderRadius: 12,
                                    border: isActive
                                        ? '2px solid var(--tw-primary)'
                                        : '1px solid var(--tw-border)',
                                    background: isActive ? 'var(--tw-tag)' : 'var(--tw-surface)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--tw-font-body)',
                                    textAlign: 'left',
                                    color: 'var(--tw-text)',
                                    width: '100%',
                                }}
                            >
                                {/* color preview dots */}
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    {[
                                        previewColors.primary,
                                        previewColors.primaryLight,
                                        previewColors.accent,
                                        previewColors.bg,
                                    ].map((color, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                background: color,
                                                border: '1px solid rgba(0,0,0,0.1)',
                                            }}
                                        />
                                    ))}
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: isActive ? 600 : 500,
                                        }}
                                    >
                                        {p.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: 'var(--tw-text-muted)',
                                            marginTop: 2,
                                        }}
                                    >
                                        {p.description}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* font */}
            <section style={{ marginBottom: 32 }}>
                <h2
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 12,
                    }}
                >
                    Шрифт
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(Object.keys(FONT_PAIRS) as FontPairKey[]).map((key) => {
                        const f = FONT_PAIRS[key]
                        const isActive = fontPair === key

                        return (
                            <button
                                key={key}
                                onClick={() => setFontPair(key)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    padding: '14px 16px',
                                    borderRadius: 12,
                                    border: isActive
                                        ? '2px solid var(--tw-primary)'
                                        : '1px solid var(--tw-border)',
                                    background: isActive ? 'var(--tw-tag)' : 'var(--tw-surface)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    color: 'var(--tw-text)',
                                    width: '100%',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 14,
                                            fontWeight: isActive ? 600 : 500,
                                            fontFamily: 'var(--tw-font-body)',
                                        }}
                                    >
                                        {f.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: 'var(--tw-text-muted)',
                                            fontFamily: 'var(--tw-font-body)',
                                        }}
                                    >
                                        {f.description}
                                    </span>
                                </div>
                                {/* Font preview */}
                                <div>
                                    <div
                                        style={{
                                            fontFamily: f.display,
                                            fontSize: 22,
                                            lineHeight: 1.2,
                                            marginBottom: 4,
                                        }}
                                    >
                                        Заголовок новости
                                    </div>
                                    <div
                                        style={{
                                            fontFamily: f.body,
                                            fontSize: 14,
                                            color: 'var(--tw-text-secondary)',
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        Основной текст статьи выглядит так. Алькарас продолжает
                                        впечатлять теннисный мир.
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
