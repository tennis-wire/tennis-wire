// Made-up draws for the dev page and the tests. Deterministic from a seed, and built to hold every
// case a draw has to show: byes, qualifiers, a retirement, a walkover, a match being played. The
// names are invented, so no real player is given results he did not have.

import type {
    Draw,
    Entry,
    EntryType,
    Group,
    GroupRow,
    Knockout,
    Match,
    Player,
    SetScore,
    Side,
    SideKey,
    Stage,
} from './types'

type Random = () => number

// mulberry32: small, and the same sequence everywhere
function random(seed: number): Random {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const pick = <T>(next: Random, items: readonly T[]): T => items[Math.floor(next() * items.length)]

const between = (next: Random, low: number, high: number) =>
    low + Math.floor(next() * (high - low + 1))

function shuffle<T>(next: Random, items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const held = out[i]
        out[i] = out[j]
        out[j] = held
    }
    return out
}

const MEN = [
    'Марко',
    'Лукас',
    'Андреа',
    'Феликс',
    'Томас',
    'Даниэль',
    'Николас',
    'Матео',
    'Себастьян',
    'Оскар',
    'Хуго',
    'Леон',
    'Адриан',
    'Виктор',
    'Пабло',
    'Эмиль',
    'Артур',
    'Давид',
    'Йонас',
    'Рафаэль',
]

const WOMEN = [
    'Анна',
    'Мария',
    'Елена',
    'Клара',
    'Ева',
    'Лаура',
    'Софи',
    'Нина',
    'Ирина',
    'Алиса',
    'Вера',
    'Дарья',
    'Юлия',
    'Ольга',
    'Петра',
    'Марта',
    'Ника',
    'Зоя',
    'Лея',
    'Тереза',
]

const SURNAMES = [
    'Ресселли',
    'Варга',
    'Брандт',
    'Хорват',
    'Ласло',
    'Фонтен',
    'Риццо',
    'Сандберг',
    'Ковач',
    'Ортега',
    'Линд',
    'Бергер',
    'Дюваль',
    'Мендес',
    'Перич',
    'Хальворсен',
    'Окафор',
    'Танака',
    'Сильва',
    'Ферро',
    'Келлер',
    'Арнау',
    'Бьорк',
    'Демир',
    'Кастро',
    'Лоренц',
    'Марин',
    'Наварро',
    'Пашич',
    'Радек',
    'Сальва',
    'Тамм',
    'Узуну',
    'Фальк',
    'Эрдем',
    'Йокинен',
    'Бауэр',
    'Гусман',
    'Дрезен',
    'Морено',
]

const COURTS = ['Центральный корт', 'Корт 1', 'Корт 2', 'Корт 3']

const HOUR = 3_600_000
const DAY = 24 * HOUR

function people(next: Random, count: number, women: boolean, prefix: string): Player[] {
    const seen = new Set<string>()
    const out: Player[] = []
    while (out.length < count) {
        const first = pick(next, women ? WOMEN : MEN)
        const lastName = pick(next, SURNAMES)
        const name = `${first} ${lastName}`
        if (seen.has(name)) continue
        seen.add(name)
        out.push({ id: `${prefix}-p${out.length + 1}`, name, lastName })
    }
    return out
}

// The strongest first, so the seeds are the first ones
function entries(
    next: Random,
    count: number,
    seeds: number,
    options: { women: boolean; doubles: boolean; prefix: string }
): Entry[] {
    const size = options.doubles ? 2 : 1
    const pool = people(next, count * size, options.women, options.prefix)
    return Array.from({ length: count }, (_, i) => ({
        id: `${options.prefix}-e${i + 1}`,
        players: pool.slice(i * size, (i + 1) * size),
        ...(i < seeds ? { seed: i + 1 } : {}),
    }))
}

// The standard order of lines: 1 against N, N/2 against N/2 + 1, and so on down the draw. The
// bottom half is mirrored, so the second seed ends the draw rather than opening its lower half.
export function seedOrder(size: number): number[] {
    let order = [1, 2]
    while (order.length < size) {
        const doubled = order.length * 2
        order = order.flatMap((line) => [line, doubled + 1 - line])
    }
    return [...order.slice(0, size / 2), ...order.slice(size / 2).reverse()]
}

// One set won by winner. The deciding set of a best of five goes to a tiebreak to 10 at 6:6, as at
// the Slams; any other to one to 7.
function set(next: Random, winner: SideKey, long: boolean): SetScore {
    const roll = next()
    let high = 6
    let low = between(next, 0, 4)
    let tiebreak: { won: number; lost: number } | undefined
    if (roll > 0.8) {
        high = 7
        low = 6
        const to = long ? 10 : 7
        const lost = between(next, 0, to + 2)
        tiebreak = { won: Math.max(to, lost + 2), lost }
    } else if (roll > 0.68) {
        high = 7
        low = 5
    }
    const score: SetScore = winner === 'a' ? { a: high, b: low } : { a: low, b: high }
    if (tiebreak) {
        score.tiebreak =
            winner === 'a'
                ? { a: tiebreak.won, b: tiebreak.lost }
                : { a: tiebreak.lost, b: tiebreak.won }
    }
    return score
}

// In place of a deciding set, as doubles on the tour play it: points, to 10
function matchTiebreak(next: Random, winner: SideKey): SetScore {
    const lost = between(next, 0, 11)
    const won = Math.max(10, lost + 2)
    return winner === 'a'
        ? { a: won, b: lost, matchTiebreak: true }
        : { a: lost, b: won, matchTiebreak: true }
}

const other = (side: SideKey): SideKey => (side === 'a' ? 'b' : 'a')

function sets(next: Random, winner: SideKey, bestOf: 3 | 5, doubles: boolean): SetScore[] {
    const need = bestOf === 5 ? 3 : 2
    const lost = between(next, 0, need - 1)
    const order = shuffle(next, [
        ...Array<SideKey>(need - 1).fill(winner),
        ...Array<SideKey>(lost).fill(other(winner)),
    ])
    order.push(winner)
    const deciding = order.length === bestOf
    return order.map((side, i) => {
        const last = deciding && i === order.length - 1
        if (last && doubles) return matchTiebreak(next, side)
        return set(next, side, last && bestOf === 5)
    })
}

// Sets so far and the one being played, nobody at the winning number yet
function partial(next: Random, bestOf: 3 | 5): SetScore[] {
    const need = bestOf === 5 ? 3 : 2
    const done = between(next, 0, need - 1)
    const played = Array.from({ length: done }, (_, i) => set(next, i % 2 === 0 ? 'a' : 'b', false))
    const a = between(next, 0, 5)
    const b = Math.min(5, Math.max(0, a + between(next, -2, 2)))
    return [...played, { a, b }]
}

type Phase = 'played' | 'live' | 'ahead'

type Strength = (side: Side) => number

function play(
    next: Random,
    base: Omit<Match, 'status' | 'sets'>,
    phase: Phase,
    strength: Strength,
    format: { bestOf: 3 | 5; doubles: boolean }
): Match {
    const { a, b } = base
    // A bye is no match: the entry goes through without playing, whatever else is on
    if (a.kind === 'bye' || b.kind === 'bye') {
        return { ...base, status: 'finished', sets: [], winner: a.kind === 'bye' ? 'b' : 'a' }
    }
    if (a.kind !== 'entry' || b.kind !== 'entry' || phase === 'ahead') {
        return { ...base, status: 'scheduled', sets: [] }
    }
    if (phase === 'live') {
        return {
            ...base,
            status: 'live',
            sets: partial(next, format.bestOf),
            live: {
                server: next() < 0.5 ? 'a' : 'b',
                a: pick(next, ['0', '15', '30', '40']),
                b: pick(next, ['0', '15', '30', '40']),
            },
        }
    }
    const winner: SideKey = next() < strength(a) / (strength(a) + strength(b)) ? 'a' : 'b'
    const roll = next()
    if (roll < 0.02) return { ...base, status: 'walkover', sets: [], winner }
    if (roll < 0.05) {
        // The loser stops partway: the sets so far, and the one he did not finish
        return { ...base, status: 'retired', sets: partial(next, format.bestOf), winner }
    }
    return {
        ...base,
        status: 'finished',
        sets: sets(next, winner, format.bestOf, format.doubles),
        winner,
    }
}

export type KnockoutOptions = {
    seed: number
    prefix: string
    slots: 16 | 32 | 64 | 128
    seeds: number
    // To the top seeds, as a 28 or a 96 draw has them
    byes?: number
    bestOf: 3 | 5
    women?: boolean
    doubles?: boolean
    // Every round before it played, this one half played with one match live. Without it the whole
    // draw is played.
    upTo?: number
    start: string
}

export function knockout(options: KnockoutOptions): Knockout {
    const next = random(options.seed)
    const rounds = Math.log2(options.slots)
    const byes = options.byes ?? 0
    if (byes > options.seeds) throw new Error('Byes go to seeds, and there are fewer seeds')
    const field = entries(next, options.slots - byes, options.seeds, {
        women: options.women ?? false,
        doubles: options.doubles ?? false,
        prefix: options.prefix,
    })
    // Seeds well ahead of the rest, the rest close enough for upsets
    const power = new Map(
        field.map((entry, i) => [entry.id, (entry.seed ? 3 : 1) * (field.length - i) + next() * 40])
    )
    const strength: Strength = (side) =>
        side.kind === 'entry' ? (power.get(side.entry.id) ?? 1) : 1

    const unseeded = shuffle(next, field.slice(options.seeds))
    const types: EntryType[] = [
        ...Array<EntryType>(options.slots / 8).fill('Q'),
        ...Array<EntryType>(Math.floor(options.slots / 32) + 1).fill('WC'),
        'LL',
    ]
    types.forEach((type, i) => {
        if (unseeded[i]) unseeded[i].entryType = type
    })

    const order = seedOrder(options.slots)
    const lines: (Side | undefined)[] = order.map((line) =>
        line <= options.seeds ? { kind: 'entry', entry: field[line - 1] } : undefined
    )
    for (let seed = 1; seed <= byes; seed++) {
        // index ^ 1 is the line a seed meets in the first round
        lines[order.indexOf(seed) ^ 1] = { kind: 'bye' }
    }
    let rest = 0
    const firstRound: Side[] = lines.map(
        (line) => line ?? { kind: 'entry', entry: unseeded[rest++] }
    )

    const start = Date.parse(options.start)
    const format = { bestOf: options.bestOf, doubles: options.doubles ?? false }
    const matches: Match[] = []
    let sides = firstRound
    for (let round = 1; round <= rounds; round++) {
        const inRound = sides.length / 2
        const half = Math.floor(inRound / 2)
        const advancing: Side[] = []
        for (let number = 1; number <= inRound; number++) {
            const phase: Phase =
                options.upTo === undefined || round < options.upTo
                    ? 'played'
                    : round > options.upTo
                      ? 'ahead'
                      : number <= half
                        ? 'played'
                        : number === half + 1
                          ? 'live'
                          : 'ahead'
            const match = play(
                next,
                {
                    id: `${options.prefix}-r${round}-m${number}`,
                    round,
                    number,
                    a: sides[2 * number - 2],
                    b: sides[2 * number - 1],
                    scheduledAt: new Date(
                        start + (round - 1) * DAY + 11 * HOUR + (number % 4) * 2 * HOUR
                    ).toISOString(),
                    court: COURTS[number % COURTS.length],
                },
                phase,
                strength,
                format
            )
            matches.push(match)
            advancing.push(match.winner ? match[match.winner] : { kind: 'pending' })
        }
        sides = advancing
    }
    return { kind: 'knockout', rounds, matches }
}

export type FinalsOptions = {
    seed: number
    prefix: string
    women?: boolean
    doubles?: boolean
    // Group rounds played, 0 to 3; the next one has its first match live
    played: number
    start: string
}

const GROUP_ROUNDS: [number, number][][] = [
    [
        [0, 3],
        [1, 2],
    ],
    [
        [0, 2],
        [3, 1],
    ],
    [
        [0, 1],
        [2, 3],
    ],
]

const done = (match: Match) => match.status !== 'scheduled' && match.status !== 'live'

// Wins, then sets won less lost. The real order comes from the provider: the tie-breaks of the
// tours differ, and this does not try to copy them.
function standings(members: Entry[], matches: Match[], complete: boolean): GroupRow[] {
    const rows = members.map((entry) => ({ entry, won: 0, lost: 0, setsWon: 0, setsLost: 0 }))
    const row = (side: Side) =>
        side.kind === 'entry' ? rows.find((r) => r.entry.id === side.entry.id) : undefined
    for (const match of matches.filter(done)) {
        const a = row(match.a)
        const b = row(match.b)
        if (!a || !b || !match.winner) continue
        const [won, lost] = match.winner === 'a' ? [a, b] : [b, a]
        won.won += 1
        lost.lost += 1
        for (const s of match.sets) {
            if (s.a > s.b) {
                a.setsWon += 1
                b.setsLost += 1
            } else if (s.b > s.a) {
                b.setsWon += 1
                a.setsLost += 1
            }
        }
    }
    return rows
        .sort(
            (x, y) =>
                y.won - x.won ||
                y.setsWon - y.setsLost - (x.setsWon - x.setsLost) ||
                (x.entry.seed ?? 99) - (y.entry.seed ?? 99)
        )
        .map((r, i) => ({ ...r, qualified: complete && i < 2 }))
}

const placeholder = (place: number, group: Group): Side => ({
    kind: 'pending',
    label: `${place}-й группы ${group.name.replace('Группа ', '')}`,
})

// Two groups of four, round robin, then semi-finals across the groups and a final, as the season
// finals play it
export function finals(options: FinalsOptions): Stage[] {
    const next = random(options.seed)
    const field = entries(next, 8, 8, {
        women: options.women ?? false,
        doubles: options.doubles ?? false,
        prefix: options.prefix,
    })
    const power = new Map(field.map((entry, i) => [entry.id, 20 - i + next() * 12]))
    const strength: Strength = (side) =>
        side.kind === 'entry' ? (power.get(side.entry.id) ?? 1) : 1
    const start = Date.parse(options.start)
    const format = { bestOf: 3 as const, doubles: options.doubles ?? false }

    const split = [
        { id: `${options.prefix}-ga`, name: 'Группа А', members: [0, 3, 4, 7] },
        { id: `${options.prefix}-gb`, name: 'Группа Б', members: [1, 2, 5, 6] },
    ]
    const groups: Group[] = split.map(({ id, name, members }, g) => {
        const squad = members.map((i) => field[i])
        const matches = GROUP_ROUNDS.flatMap((pairs, r) =>
            pairs.map(([x, y], n) => {
                const round = r + 1
                const phase: Phase =
                    round <= options.played
                        ? 'played'
                        : round === options.played + 1 && n === 0 && g === 0
                          ? 'live'
                          : 'ahead'
                return play(
                    next,
                    {
                        id: `${id}-r${round}-m${n + 1}`,
                        round,
                        number: n + 1,
                        a: { kind: 'entry', entry: squad[x] },
                        b: { kind: 'entry', entry: squad[y] },
                        scheduledAt: new Date(
                            start + r * 2 * DAY + g * DAY + (n === 0 ? 14 : 20) * HOUR
                        ).toISOString(),
                        court: 'Центральный корт',
                    },
                    phase,
                    strength,
                    format
                )
            })
        )
        return { id, name, rows: standings(squad, matches, options.played >= 3), matches }
    })

    const [first, second] = groups
    const sideOf = (group: Group, place: number): Side =>
        group.rows[place - 1].qualified
            ? { kind: 'entry', entry: group.rows[place - 1].entry }
            : placeholder(place, group)
    const playoffDay = start + 6 * DAY
    const semis: Match[] = [
        [sideOf(first, 1), sideOf(second, 2)],
        [sideOf(second, 1), sideOf(first, 2)],
    ].map(([a, b], i): Match => ({
        id: `${options.prefix}-sf${i + 1}`,
        round: 1,
        number: i + 1,
        a,
        b,
        status: 'scheduled',
        sets: [],
        scheduledAt: new Date(playoffDay + (i === 0 ? 14 : 20) * HOUR).toISOString(),
        court: 'Центральный корт',
    }))
    const final: Match = {
        id: `${options.prefix}-f`,
        round: 2,
        number: 1,
        a: { kind: 'pending' },
        b: { kind: 'pending' },
        status: 'scheduled',
        sets: [],
        scheduledAt: new Date(playoffDay + DAY + 18 * HOUR).toISOString(),
        court: 'Центральный корт',
    }
    return [
        { kind: 'groups', groups },
        { kind: 'knockout', rounds: 2, matches: [...semis, final] },
    ]
}

// What the dev page offers: one of each kind of draw the site will have to show
export type Scenario = { id: string; title: string; draws: () => Draw[] }

const START = '2026-06-29T00:00:00Z'

export const SCENARIOS: Scenario[] = [
    {
        id: 'slam',
        title: '«Шлем», идёт 1/8 финала',
        draws: () => [
            {
                id: 'ms',
                kind: 'ms',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 1,
                        prefix: 'ms',
                        slots: 128,
                        seeds: 32,
                        bestOf: 5,
                        upTo: 4,
                        start: START,
                    }),
                ],
            },
            {
                id: 'ws',
                kind: 'ws',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 2,
                        prefix: 'ws',
                        slots: 128,
                        seeds: 32,
                        bestOf: 3,
                        women: true,
                        upTo: 4,
                        start: START,
                    }),
                ],
            },
            {
                id: 'md',
                kind: 'md',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 3,
                        prefix: 'md',
                        slots: 64,
                        seeds: 16,
                        bestOf: 3,
                        doubles: true,
                        upTo: 3,
                        start: START,
                    }),
                ],
            },
        ],
    },
    {
        id: 'masters',
        title: 'Мастерс на 96, сыгран',
        draws: () => [
            {
                id: 'ms',
                kind: 'ms',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 4,
                        prefix: 'ms',
                        slots: 128,
                        seeds: 32,
                        byes: 32,
                        bestOf: 3,
                        start: START,
                    }),
                ],
            },
            {
                id: 'ws',
                kind: 'ws',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 5,
                        prefix: 'ws',
                        slots: 128,
                        seeds: 32,
                        byes: 32,
                        bestOf: 3,
                        women: true,
                        start: START,
                    }),
                ],
            },
        ],
    },
    {
        id: 'small',
        title: 'Турнир на 28, первый круг',
        draws: () => [
            {
                id: 'ms',
                kind: 'ms',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 6,
                        prefix: 'ms',
                        slots: 32,
                        seeds: 8,
                        byes: 4,
                        bestOf: 3,
                        upTo: 1,
                        start: START,
                    }),
                ],
            },
            {
                id: 'md',
                kind: 'md',
                qualifying: false,
                stages: [
                    knockout({
                        seed: 7,
                        prefix: 'md',
                        slots: 16,
                        seeds: 4,
                        bestOf: 3,
                        doubles: true,
                        upTo: 1,
                        start: START,
                    }),
                ],
            },
        ],
    },
    {
        id: 'finals',
        title: 'Итоговый, групповой этап',
        draws: () => [
            {
                id: 'ms',
                kind: 'ms',
                qualifying: false,
                stages: finals({ seed: 8, prefix: 'ms', played: 2, start: START }),
            },
            {
                id: 'md',
                kind: 'md',
                qualifying: false,
                stages: finals({ seed: 9, prefix: 'md', doubles: true, played: 3, start: START }),
            },
        ],
    },
]
