'use client'

import { useTheme, PALETTES, FONT_PAIRS } from '@/theme'
import type { PaletteKey, FontPairKey } from '@/theme'

export default function SettingsPage() {
    const { palette, fontPair, isDark, setPalette, setFontPair, toggleDark, colors } = useTheme()

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
                    {[
                        { label: 'Светлая', value: false, icon: '☀️' },
                        { label: 'Тёмная', value: true, icon: '🌙' },
                    ].map((option) => (
                        <button
                            key={option.label}
                            onClick={() => {
                                if (isDark !== option.value) toggleDark()
                            }}
                            style={{
                                flex: 1,
                                padding: '14px 16px',
                                borderRadius: 12,
                                border:
                                    isDark === option.value
                                        ? '2px solid var(--tw-primary)'
                                        : '1px solid var(--tw-border)',
                                background:
                                    isDark === option.value ? 'var(--tw-tag)' : 'var(--tw-surface)',
                                cursor: 'pointer',
                                fontFamily: 'var(--tw-font-body)',
                                fontSize: 14,
                                color: 'var(--tw-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <span style={{ fontSize: 20 }}>{option.icon}</span>
                            <span style={{ fontWeight: isDark === option.value ? 600 : 400 }}>
                                {option.label}
                            </span>
                        </button>
                    ))}
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
