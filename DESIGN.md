# Pulse design direction

Pulse is a desktop download manager for direct links, YouTube and torrents. The interface should read like a calm instrument panel: dense where the data is, quiet everywhere else. It is a tool people leave open for hours, not a landing page.

## Dials

- **ENERGY 1**: low. The download list is the work; the shell does not compete with it.
- **RHYTHM 2**: mostly consistent, with two deliberate breaks: the wider speed tile in the stats strip and the detail panel.
- **MOTION 1**: state feedback only. Progress width, hover, pressed, focus. No pulsing dots, no entrance choreography, no looping decoration.

## Identity

- **Motif**: the pulse waveform from the app icon. It appears in the logo mark, nowhere else.
- **Voice**: direct and technical. No marketing adjectives, no decorative emoji.
- The app icon's blue-to-cyan gradient is the brand mark. It is the only gradient allowed as decoration; buttons, backgrounds and text do not reuse it.

## Palette

- **Neutral graphite base**: app, panel and elevated surfaces. Borders carry structure; shadows are reserved for overlays.
- **One accent**: signal blue. Used for the primary action, the current selection and progress. Not for every icon.
- **Semantic colors only for state**: green completed, amber paused or limited, red failed.
- No second decorative hue. File-type icons are neutral and rely on glyph shape.

## Typography

- **System UI** (Segoe UI Variable on Windows, `system-ui` elsewhere). A desktop utility should match the OS text rendering; Inter is not bundled and is not a brand face.
- Tabular numerals for speeds, sizes, percentages and ETAs.
- Mono only for hashes and filesystem paths.
- Sentence case for labels. No wide-tracked uppercase micro labels.

## Shape and elevation

- Radius scale: 12px cards, 8px controls, 6px chips, full only for progress tracks and switches.
- One border weight. No glow.
- Shadow: overlays only (modal, dropdown, toast).

## Interaction

- Every interactive element has hover, pressed, disabled and focus-visible states.
- Both themes meet WCAG AA for body text.
- Empty, loading and error states name the cause and the next action.
- Reduced motion is respected.

## Non-goals

- No glassmorphism on cards, modals or the sidebar.
- No gradient text, gradient primary buttons, rainbow file-type tiles, decorative status dots, or pill-shaped everything.
