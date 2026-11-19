import type { RoundName } from '@/lib/tennis/rounds'
import type { DrawKind, MatchStatus } from '@/lib/tennis/types'

// Every word the draw shows
export const strings = {
    drawsLabel: 'Разряд',
    roundsLabel: 'Раунд',
    // With both men and women on one page the draw is named by who plays it
    draws: {
        ms: 'Мужчины',
        ws: 'Женщины',
        md: 'Мужские пары',
        wd: 'Женские пары',
        xd: 'Микст',
    } satisfies Record<DrawKind, string>,
    singles: 'Одиночный',
    doubles: 'Парный',
    qualifying: 'квалификация',
    roundFull: (name: RoundName) =>
        'fraction' in name
            ? name.fraction === 2
                ? 'Финал'
                : `1/${name.fraction / 2} финала`
            : `${name.number}-й круг`,
    roundShort: (name: RoundName) =>
        'fraction' in name
            ? name.fraction === 2
                ? 'Финал'
                : `1/${name.fraction / 2}`
            : `${name.number}-й круг`,
    groupStage: 'Групповой этап',
    playoff: 'Плей-офф',
    pending: 'Определится',
    bye: 'Без соперника',
    live: 'LIVE',
    status: {
        retired: 'Отказ',
        walkover: 'Неявка',
        defaulted: 'Дисквалификация',
        cancelled: 'Отменён',
        suspended: 'Прерван',
    } satisfies Partial<Record<MatchStatus, string>>,
    table: { player: 'Игрок', matches: 'Матчи', sets: 'Сеты' },
    qualified: 'Вышел в плей-офф',
    serving: 'Подаёт',
    // The reader's own draw
    modesLabel: 'Чья сетка',
    modes: { real: 'Как есть', mine: 'Мой прогноз' },
    picksHint:
        'Нажмите на игрока, чтобы провести его дальше. Прогноз видите только вы, он хранится в этом браузере.',
    reset: 'Сбросить прогноз',
    marks: {
        picked: { glyph: '✓', label: 'ваш выбор' },
        right: { glyph: '✓', label: 'угадали' },
        wrong: { glyph: '✗', label: 'не угадали' },
        out: { glyph: '', label: 'выбыл' },
    },
    missed: 'Ваш выбор:',
    // What a screen reader hears for a match: the grid of numbers alone says little
    match: (a: string, b: string, score: string, winner: string | null, live: boolean) =>
        [
            `${a} — ${b}`,
            live ? 'идёт' : null,
            score || null,
            winner ? `победитель: ${winner}` : null,
        ]
            .filter(Boolean)
            .join(', '),
}
