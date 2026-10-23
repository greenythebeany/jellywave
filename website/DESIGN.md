# Design System: Triptych website
**Project ID:** none (no Stitch project; this file holds the fixed brand rules only)

Everything not written here (layout, type pairing, motion, section design) is open
and decided in `src/styles.css` (direction D, "Pinned Poster", chosen from four prototypes).

## 1. Visual Theme & Atmosphere
A triptych is one work in three panels. The site tells that story: one library,
three ways to look at it (Spotify, Apple Music and Nothing styles). The mood is
calm, high-contrast and gallery-like: mostly ink and paper, with a single red
mark that draws the eye the way the red bar does in the logo. Restraint is the
point; nothing decorative competes with the three panels.

## 2. Color Palette & Roles
- **Ink Black** (#000000 to #0A0A0B): the dark-theme canvas and the light-theme text and logo bars.
- **Paper White** (#FFFFFF to #F4F4F4): the light-theme canvas and the dark-theme text and logo bars.
- **Signal Red** (#D71921): the third logo bar and the one accent. Used sparingly: at most
  one or two red moments per screen (a full stop, an active state, a single call to action).
  Never as a large background fill, never for body text, never as a gradient.
- **Neutral greys** (open, per direction): only for secondary text, hairlines and surfaces,
  always derived from black/white with no colour tint.

Both themes are first-class: dark follows `prefers-color-scheme: dark`, light follows light.

## 3. Typography Rules
Open per direction, with one fixed rule: **Doto** (dot matrix) stays in the type system as
a nod to the Nothing style, for at least the wordmark or one display role. Fonts are
self-hosted (no font CDNs). Body type is free to change from Poppins.

## 4. Component Stylings
* **Logo:** three vertical bars with softly rounded corners (rx 24 on a 113-wide bar),
  short, tall, short, in the 411 × 453 grid of `brand/triptych-*.svg`. Left and middle bars
  take the text colour (black on light, white on dark); the right bar is always Signal Red.
  Drawn as inline SVG so it stays crisp and themeable. Never recolour the bars into a
  gradient, never rotate, outline, add effects, or change the bar proportions. Minimum
  size 16 px tall; clear space around it at least one bar width.
* **Wordmark:** "Triptych", optionally followed by a Signal Red full stop.
* **Buttons, cards, inputs:** open per direction.

## 5. Layout Principles
Open per direction. The one fixed principle is the three-panel idea: wherever the three
interface styles are shown together, they appear as three equal panels side by side
(stacked on narrow screens). In the hero carousel the order is Nothing, Spotify, Apple Music; in the three-panel row the app panel comes last, in red, like the red bar.
