# Frontend styling

## The rule

`sx` and inline styles are for **layout only**: flex, grid, gap, padding, margin,
width, height, position.

Colour, font, radius, shadow and elevation come from the theme. When the theme
cannot express something, extend the theme — do not write the value into a
component.

```tsx
// no
<Paper sx={{ borderRadius: '14px', backgroundColor: colors.surface, boxShadow: colors.cardShadow }}>
<Typography sx={{ fontFamily: 'var(--tw-font-display)', fontSize: '1.25rem', fontWeight: 700 }}>

// yes
<Paper sx={{ p: 3, mb: 2.5 }}>
<Typography variant="h5">
```

## Where a value lives

| Kind | Source |
| --- | --- |
| Palette colours | `theme/palettes.ts`, reached through the MUI theme (`'divider'`, `'background.paper'`, `'text.secondary'`) |
| Fonts | `theme/fonts.ts`, applied by `createAppTheme` typography — use `variant`, not `fontFamily` |
| Radii | `RADIUS` in `theme/tokens.ts` — `sm` controls, `md` inputs and buttons, `lg` cards and dialogs |
| Primary tints | `TINT` in `theme/tokens.ts`, applied with MUI's `alpha()` |
| Spacing | MUI's spacing scale (`p: 3`, `mb: 2.5`), never raw pixels |
| Component defaults | `theme/createAppTheme.ts` |

`useAppTheme().colors` stays available, but prefer the MUI palette path: it
resolves per mode without the component knowing which mode is active.

## CSS variables

`--tw-*` are set on `document.documentElement` by `ThemeContext`. They exist for
markup MUI does not reach — `features/editor/styles/editor.css`, which styles
what Tiptap renders. Do not reach for them inside `sx`; there the MUI theme is
already in scope.

## Markup this app does not render

`MarkdownMessage` styles what `react-markdown` emits, and `editor.css` styles
what Tiptap emits. There is no `variant` to reach for on a `<pre>` that arrived
from a library, so those places address elements directly.

They still take their values from the theme. Inside `sx` the MUI theme is in
scope, so use it — `fontPair.display` from `useAppTheme()`, `RADIUS`, palette
paths. `--tw-*` is only for `editor.css`, which sits outside React entirely.

## Hardcoded colours

A literal hex or `rgba()` in a component is a dark-mode bug waiting to happen.
The two cases that are legitimate:

- text on a fixed-colour badge (`#fff` on a primary chip), where contrast is set
  by the badge, not by the mode;
- a scrim over arbitrary content, such as a button on top of a user-uploaded
  photo. Derive it from the theme: `alpha(theme.palette.background.paper, 0.9)`.

## Migration

Older editor components predate this and still mix all three channels. They are
converted when touched for another reason, not in a sweep of their own.
`MetadataPanel`'s outer `<Paper>` is the worked example.
