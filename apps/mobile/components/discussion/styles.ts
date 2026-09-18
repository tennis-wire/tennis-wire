// Mirrors public-web/components/discussion/styles.ts, but as a factory rather than static
// exports: there are no CSS custom properties here, so colors have to come from useTheme() at
// render time. The button-reset properties on web's linkButton (background/border/padding/
// cursor) have no RN equivalent -- a Pressable has no default chrome to reset -- so only the
// text styling carries over.

import type { TextStyle } from 'react-native'

import type { PaletteColors } from '../../theme'

export type DiscussionStyles = {
    muted: TextStyle
    linkButton: TextStyle
    // Under a comment: reply, show the thread, retry. Quiet, because the comment is the thing to
    // read. Except for the one that opens a thread, which is the reader's way further in.
    action: TextStyle
}

export function discussionStyles(colors: PaletteColors): DiscussionStyles {
    const linkButton: TextStyle = { color: colors.primary, fontSize: 13 }
    return {
        muted: { color: colors.textMuted, fontSize: 13 },
        linkButton,
        action: { ...linkButton, color: colors.textSecondary, fontWeight: '500' },
    }
}
