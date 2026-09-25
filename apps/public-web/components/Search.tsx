'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TagResult {
    name: string
    slug: string
    type: 'player' | 'tournament' | 'organization' | 'topic' | 'section'
}

// Mock data based on DB seed, will be replaced with API call
const MOCK_TAGS: TagResult[] = [
    { name: 'Новак Джокович', slug: 'novak-djokovic', type: 'player' },
    { name: 'Карлос Алькарас', slug: 'carlos-alcaraz', type: 'player' },
    { name: 'Янник Синнер', slug: 'jannik-sinner', type: 'player' },
    { name: 'Даниил Медведев', slug: 'daniil-medvedev', type: 'player' },
    { name: 'Александр Зверев', slug: 'alexander-zverev', type: 'player' },
    { name: 'Арина Соболенко', slug: 'aryna-sabalenka', type: 'player' },
    { name: 'Ига Швёнтек', slug: 'iga-swiatek', type: 'player' },
    { name: 'Коко Гофф', slug: 'coco-gauff', type: 'player' },
    { name: 'Елена Рыбакина', slug: 'elena-rybakina', type: 'player' },
    { name: 'Australian Open', slug: 'australian-open', type: 'tournament' },
    { name: 'Roland Garros', slug: 'roland-garros', type: 'tournament' },
    { name: 'Wimbledon', slug: 'wimbledon', type: 'tournament' },
    { name: 'US Open', slug: 'us-open', type: 'tournament' },
    { name: 'ATP', slug: 'atp', type: 'organization' },
    { name: 'WTA', slug: 'wta', type: 'organization' },
    { name: 'ITF', slug: 'itf', type: 'organization' },
    { name: 'Травмы', slug: 'injuries', type: 'topic' },
    { name: 'Допинг', slug: 'doping', type: 'topic' },
    { name: 'Интервью', slug: 'interview', type: 'topic' },
    { name: 'Треш-зона', slug: 'trash', type: 'section' },
]

const TYPE_LABELS: Record<TagResult['type'], string> = {
    player: 'Игрок',
    tournament: 'Турнир',
    organization: 'Организация',
    topic: 'Тема',
    section: 'Раздел',
}

const iconButton: React.CSSProperties = {
    width: 34,
    height: 34,
    padding: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'none',
    color: 'var(--tw-text-secondary)',
    cursor: 'pointer',
}

const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
} as const

function getTagRoute(tag: TagResult): string {
    switch (tag.type) {
        case 'player':
            return `/players/${tag.slug}`
        case 'tournament':
            return `/tournaments/${tag.slug}`
        case 'section':
            return `/sections/${tag.slug}`
        default:
            return `/tags/${tag.slug}`
    }
}

export default function Search() {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    // Below 1025px the field folds into a button and opens over the header line
    const [expanded, setExpanded] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const openRef = useRef<HTMLButtonElement>(null)
    const router = useRouter()

    const results =
        query.length >= 1
            ? MOCK_TAGS.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase())).slice(
                  0,
                  8
              )
            : []

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                setExpanded(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    useEffect(() => {
        if (expanded) inputRef.current?.focus()
    }, [expanded])

    function fold() {
        setQuery('')
        setIsOpen(false)
        setExpanded(false)
        openRef.current?.focus()
    }

    function navigate(tag: TagResult) {
        setQuery('')
        setIsOpen(false)
        setExpanded(false)
        router.push(getTagRoute(tag))
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Escape' && expanded) return fold()
        if (!isOpen || results.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        } else if (e.key === 'Enter' && highlightIndex >= 0) {
            e.preventDefault()
            navigate(results[highlightIndex])
        } else if (e.key === 'Escape') {
            setIsOpen(false)
            inputRef.current?.blur()
        }
    }

    return (
        <div ref={wrapperRef} className="tw-search" data-open={expanded || undefined}>
            <button
                ref={openRef}
                type="button"
                className="tw-search-open"
                aria-label="Поиск"
                onClick={() => setExpanded(true)}
                style={iconButton}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="10.5" cy="10.5" r="6.5" {...stroke} />
                    <path d="M15.5 15.5 21 21" {...stroke} />
                </svg>
            </button>

            <div className="tw-search-field">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setIsOpen(true)
                        setHighlightIndex(-1)
                    }}
                    onFocus={() => query.length >= 1 && setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Поиск"
                    className="tw-search-input"
                    style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 17,
                        border: '1px solid var(--tw-border)',
                        background: 'transparent',
                        color: 'var(--tw-text)',
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.15s',
                    }}
                />

                {isOpen && results.length > 0 && (
                    <div
                        className="tw-search-results"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            marginTop: 4,
                            background: 'var(--tw-surface)',
                            border: '1px solid var(--tw-border)',
                            borderRadius: 10,
                            boxShadow: 'var(--tw-card-shadow)',
                            padding: 4,
                            zIndex: 50,
                        }}
                    >
                        {results.map((tag, i) => (
                            <button
                                key={tag.slug}
                                onClick={() => navigate(tag)}
                                onMouseEnter={() => setHighlightIndex(i)}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background:
                                        i === highlightIndex ? 'var(--tw-bg-alt)' : 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    color: 'var(--tw-text)',
                                    textAlign: 'left',
                                }}
                            >
                                <span>{tag.name}</span>
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--tw-text-muted)',
                                        flexShrink: 0,
                                        marginLeft: 12,
                                    }}
                                >
                                    {TYPE_LABELS[tag.type]}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {isOpen && query.length >= 1 && results.length === 0 && (
                    <div
                        className="tw-search-results"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            marginTop: 4,
                            background: 'var(--tw-surface)',
                            border: '1px solid var(--tw-border)',
                            borderRadius: 10,
                            boxShadow: 'var(--tw-card-shadow)',
                            padding: '12px 14px',
                            zIndex: 50,
                            fontSize: 13,
                            color: 'var(--tw-text-muted)',
                        }}
                    >
                        Ничего не найдено
                    </div>
                )}

                <button
                    type="button"
                    className="tw-search-close"
                    aria-label="Закрыть поиск"
                    onClick={fold}
                    style={iconButton}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                        <path d="M6 6 18 18M18 6 6 18" {...stroke} />
                    </svg>
                </button>
            </div>
        </div>
    )
}
