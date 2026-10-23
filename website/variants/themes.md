# Triptych theme (direction D, chosen)

Custom themes made with the theme-factory skill's "create your own theme" path: none
of the preset themes fit, because the brand fixes the palette (ink, paper, one red; see
`../DESIGN.md`). Each theme keeps that palette and differs in type, surface steps, shape
and spacing. Directions A (gallery), B (dot matrix) and C (editorial) were explored and dropped;
D's CSS opens with these tokens, ready to move into the final `src/styles.css`.

Shared token names: `--ground`, `--ground-2` (a surface one tone step away), `--ink`,
`--ink-2` (secondary text), `--accent`, `--font-display`, `--font-text`, `--font-mark`,
`--margin`, `--radius`, and the type steps `--step-small`, `--step-body`, `--step-lead`,
`--step-head`, `--step-display`. Light and dark are both defined; dark follows the system
unless `?theme=` overrides it.

## D · Pinned Poster
One title that never moves while the three looks lock into place beneath it, like covers
of the same magazine: heavy grotesk, full-bleed screenshots, nothing else.

- **Paper** `#FFFFFF` / **Ink field** `#000000`
- **Showcase**: the hero is the full-bleed screenshot carousel (Nothing, Spotify, Apple Music) under black scrims; the boot dims and blurs it (55% black, 18px blur) behind the logo meter
- **Ink** `#000000` / `#FFFFFF`
- **Soft ink** `#4D4D4D` / `#B3B3B3`
- **Signal Red** `#D71921`: the third bar and the pinned title's full stop
- **Headers**: Cabinet Grotesk 800, uppercase title, -0.035em
- **Body**: Cabinet Grotesk 400/500
- Square buttons, 24px margins, full-height panels.
