# DELAY design contract

The visual reference is a spaceflight communications console. Keep the interface compact: mission route, terminal, and clocks. No hero headline, taglines, decorative paragraphs, or planet illustrations. Earth and Mars are plain labels linked by a line and a small ASCII ship marker. The terminal background is **solid black (`#000000`) in both themes**.

## Explicitly banned

- Inter and Fraunces, including fallback stacks.
- Purple gradients or purple accents.
- Floating bento boxes and soft drop shadows.
- Glowing borders, neon outlines, bloom, and decorative text glow.
- Stock fade-in or fade-and-slide entrance animations.
- Generic glassmorphism, pill-shaped controls, and ornamental dashboard widgets.

## Color and hierarchy

Warm ivory on black carries the writing. Amber marks actions, commands, and the travel phase. Muted sage indicates connectivity. Blue-gray identifies Earth; oxide red identifies Mars and becomes more prominent in the settlement phase. Color always has a text label as well.

The surrounding page uses near-black graphite in dark mode and uncoated-paper ivory in light mode. Its tokens change with the theme; the terminal retains its black console surface and its own readable text tokens. Thin matte separators establish hierarchy without shadows or light effects.

## Type

Locally hosted **IBM Plex Mono** is the typeface throughout. It ships with its upstream SIL Open Font License. There are no third-party font requests at runtime. Numerals in clocks remain monospaced and stable.

## Tokens

`assets/css/tokens.css` owns semantic theme colors; terminal colors; font families, weights, scales, line heights, and tracking; spacing; radii; borders; motion; layout width; and component tokens for buttons, inputs, and cards/instruments. `site.css` applies those tokens. Responsive geometry and tiny diagram strokes are implementation dimensions. Keep future visual changes in the token layer rather than introducing new palettes or component styles.

## Motion

Only context-specific motion: one terminal line types in, a cursor blinks, and the ship position interpolates after mission changes. No fades. `prefers-reduced-motion` disables all animation and transition. Flight position follows configured dates; it does not imply live spacecraft tracking.

## Access

Keyboard-operable tabs, native radio controls, labeled form fields, visible focus rings, an announced feedback region, a skip link, and a native modal dialog. Layout stacks at tablet width and collapses to one column on phones. Avoid lowering text contrast when tuning the palette.
