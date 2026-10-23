# Triptych themes (one per design direction)

Custom themes made with the theme-factory skill's "create your own theme" path: none
of the preset themes fit, because the brand fixes the palette (ink, paper, one red; see
`../DESIGN.md`). Each theme keeps that palette and differs in type, surface steps, shape
and spacing. Every variant's CSS opens with the same token names, so the chosen set can
be copied into the final `src/styles.css` as-is.

Shared token names: `--ground`, `--ground-2` (a surface one tone step away), `--ink`,
`--ink-2` (secondary text), `--accent`, `--font-display`, `--font-text`, `--font-mark`,
`--margin`, `--radius`, and the type steps `--step-small`, `--step-body`, `--step-lead`,
`--step-head`, `--step-display`. Light and dark are both defined; dark follows the system
unless `?theme=` overrides it.

## A · Gallery Wall
A museum room: white walls (or a black-box room at night), artwork hung with air around
it, and small wall labels that tell you what you are looking at.

- **Paper** `#FFFFFF` / **Black box** `#0A0A0A`: the wall
- **Mat** `#F2F2F2` / `#161616`: passe-partout around each hung panel
- **Ink** `#111111` / `#F5F5F5`: text and the first two bars
- **Label grey** `#5F5F5F` / `#A3A3A3`: secondary label lines
- **Signal Red** `#D71921`: the third bar and the gallery's red "acquired" dot
- **Headers**: Instrument Sans 500, wordmark in Doto
- **Body**: Instrument Sans 400
- Square corners, generous margins (6vw), mats 24px.

## B · Dot Matrix
The Nothing OS look as a page: a dot grid, glyph-matrix type, round widgets, monochrome
plus one red light.

- **Ground** `#000000` / `#F2F2F2`
- **Widget** `#111111` / `#FFFFFF`: round-cornered panels
- **Ink** `#FFFFFF` / `#000000`
- **Dim** `#8A8A8A` / `#6B6B6B`: secondary text, unlit dots
- **Signal Red** `#D71921`: the third bar, the "on" dot, the active state
- **Headers**: Doto 700 everywhere large
- **Body**: Space Mono 400
- Large radius (28px widgets), pill controls, 16px dot grid.

## C · Editorial
A music magazine: a big serif nameplate, an issue line, a lead story with a drop cap,
three columns for the three looks, and a red full stop the size of a headline.

- **Paper** `#FFFFFF` / **Night print** `#0B0B0B`
- **Column tint** `#F4F4F4` / `#171717`: a tone step for the sidebar and figure captions
- **Ink** `#0D0D0D` / `#F2F2F2`
- **Caption grey** `#555555` / `#A8A8A8`
- **Signal Red** `#D71921`: the third bar, the giant full stop, the drop cap
- **Headers**: Fraunces 600, optical size 144, tight tracking; wordmark in Doto
- **Body**: Fraunces 400 at text optical size, 1.65 leading
- Square corners, 12-column grid, 4vw margins.

## D · Pinned Poster
One title that never moves while the three looks pass beneath it, like covers of the same
magazine: heavy grotesk, flat fields, nothing else.

- **Paper** `#FFFFFF` / **Ink field** `#000000`
- **Grey field** `#E6E6E6` / `#1A1A1A`: the middle panel's ground
- **Ink** `#000000` / `#FFFFFF`
- **Soft ink** `#4D4D4D` / `#B3B3B3`
- **Signal Red** `#D71921`: the third bar and the pinned title's full stop
- **Headers**: Cabinet Grotesk 800, uppercase title, -0.035em
- **Body**: Cabinet Grotesk 400/500
- Square buttons, 24px margins, full-height panels.
