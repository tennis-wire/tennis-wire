// Same rule as public-web/components/auth/NicknameForm.tsx: Latin letters,
// digits, hyphen and underscore, 3 to 24. The server holds the same rule and
// the uniqueness; this only spares the reader a round trip.
const PATTERN = /^[A-Za-z0-9_-]{3,24}$/

export function isValidNickname(value: string): boolean {
    return PATTERN.test(value)
}
