// The ways to ignore someone, as discussion-service names them. The picker lists them in this
// order, mildest first; the first is the one it opens on.
export const BLOCK_MODES = ['soft', 'gravestone', 'subtree_removal'] as const

export type BlockMode = (typeof BLOCK_MODES)[number]
