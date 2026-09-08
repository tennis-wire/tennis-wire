// Values that do not change with the palette.
//
// Before this file there were eighteen spellings of borderRadius and nine
// hand-computed hex alpha suffixes across the app. Both belong to the theme,
// not to whoever happened to be writing the component.

/** Corner radii, by the kind of surface rather than by pixel count. */
export const RADIUS = {
    /** Chips, tooltips, small controls. */
    sm: 6,
    /** Inputs, buttons, alerts. Also the MUI `shape.borderRadius` default. */
    md: 10,
    /** Cards, dialogs, panels. */
    lg: 14,
} as const

// Overlay strengths for tinting a surface with the primary colour. Named by
// strength, not by state, because the same level serves as "selected" in one
// control and "hovered" in another.
//
// Pass to MUI's alpha(): alpha(theme.palette.primary.main, TINT.soft)
export const TINT = {
    faint: 0.04,
    soft: 0.08,
    medium: 0.12,
    strong: 0.18,
} as const
