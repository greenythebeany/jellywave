<p align="center">
  <img src="logo.png" width="140" alt="JellyWave logo" />
</p>

<h1 align="center">JellyWave</h1>
<p align="center">A sleek, Spotify-styled music client for your own Jellyfin server.</p>

<p align="center">
  <a href="https://github.com/Greenythebeany/jellywave/releases">
    <img src="download_icon.png" alt="Download JellyWave" height="160">
  </a>
</p>

---

JellyWave is a personal music client for a self-hosted Jellyfin server. It logs into your own server with your own library and gives you a modern, Spotify-like listening experience across desktop and Android, without any of the server-side bloat of a general-purpose media app.

## Screenshots

<p align="center">
  <img src="docs/screenshots/desktop-home.png" width="800" alt="JellyWave desktop, Home view" />
</p>
<p align="center">
  <img src="docs/screenshots/desktop-settings.png" width="380" alt="JellyWave desktop, Settings" />
</p>

<p align="center">
  <img src="docs/screenshots/mobile-home.png" width="220" alt="JellyWave Android, Home view" />
  <img src="docs/screenshots/mobile-library.png" width="220" alt="JellyWave Android, Library view" />
  <img src="docs/screenshots/mobile-nowplaying.png" width="220" alt="JellyWave Android, Now Playing view" />
</p>

## Features

- Full library browsing: Home, Search, All Songs, Liked Songs, Genres, Albums, Artists, and Playlists
- Gapless playback with optional crossfade (0-12 seconds) between tracks
- ReplayGain-based volume normalization, using loudness data from your server
- Lyrics lookup for the currently playing track
- Queue view with shuffle and repeat modes
- Native lock-screen and notification media controls on Android, including playback that survives the app going to the background
- Discord Rich Presence on desktop: shows what you're currently listening to, with cover art
- Custom CSS support for further tweaking the look of the app, including a set of ready-made community color schemes (see [Themes](#themes) below)
- Light and dark themes with multiple accent color palettes, plus a blurred cover-art background option
- "Jam on paw level": an optional cat that bounces along with the actual bass of whatever's playing
- 15 language translations (English, French, German, Slovak, Czech, Spanish, Polish, Russian, Ukrainian, Norwegian, Swedish, Finnish, Danish, Dutch, Italian) with more welcome via contribution
- Desktop app built with Electron, Android app built with Capacitor, with a built-in check for new releases on desktop

## Installation

Grab the latest build from the [Releases](https://github.com/greenythebeany/jellywave/releases/latest) page:

- **Windows**: download and run the installer (`.exe`)
- **Android**: download the `.apk` and install it (you will need to allow installs from your browser or file manager the first time)

On first launch, enter the address of your own Jellyfin server and sign in with your Jellyfin account.

## Themes

JellyWave ships a handful of built-in accent palettes, but you can also drop in a full community color scheme through **Settings → Advanced → Custom CSS** — paste one line in and it takes effect immediately, no restart needed:

| Preview | Theme | `@import` line |
| --- | --- | --- |
| ![Catppuccin Mocha](src/themes/previews/catppuccin-mocha.png) | Catppuccin Mocha | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-mocha.css');` |
| ![Catppuccin Macchiato](src/themes/previews/catppuccin-macchiato.png) | Catppuccin Macchiato | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-macchiato.css');` |
| ![Catppuccin Frappé](src/themes/previews/catppuccin-frappe.png) | Catppuccin Frappé | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-frappe.css');` |
| ![Catppuccin Latte](src/themes/previews/catppuccin-latte.png) | Catppuccin Latte | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-latte.css');` |
| ![Dracula](src/themes/previews/dracula.png) | Dracula | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/dracula.css');` |
| ![Nord](src/themes/previews/nord.png) | Nord | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/nord.css');` |
| ![Gruvbox Dark](src/themes/previews/gruvbox-dark.png) | Gruvbox Dark | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/gruvbox-dark.css');` |
| ![Gruvbox Light](src/themes/previews/gruvbox-light.png) | Gruvbox Light | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/gruvbox-light.css');` |
| ![Tokyo Night](src/themes/previews/tokyonight.png) | Tokyo Night | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/tokyonight.css');` |
| ![Rosé Pine](src/themes/previews/rose-pine.png) | Rosé Pine | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/rose-pine.css');` |
| ![Rosé Pine Moon](src/themes/previews/rose-pine-moon.png) | Rosé Pine Moon | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/rose-pine-moon.css');` |
| ![Rosé Pine Dawn](src/themes/previews/rose-pine-dawn.png) | Rosé Pine Dawn | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/rose-pine-dawn.css');` |
| ![Kanagawa](src/themes/previews/kanagawa.png) | Kanagawa | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/kanagawa.css');` |
| ![Solarized Dark](src/themes/previews/solarized-dark.png) | Solarized Dark | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/solarized-dark.css');` |
| ![Solarized Light](src/themes/previews/solarized-light.png) | Solarized Light | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/solarized-light.css');` |
| ![system24](src/themes/previews/system24.png) | system24-inspired | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/system24.css');` |

The theme source files live in [`src/themes/`](src/themes/) if you want to tweak one or build your own.

### Making your own theme

Start from [`src/themes/template.css`](src/themes/template.css) — it lists every CSS custom property the app's colors are built from, with a short comment on what each one controls. Fill in your colors, paste the whole thing into Settings → Advanced → Custom CSS to preview it live, and once you're happy, save it as `src/themes/your-theme-name.css` and open a PR to get it listed in the table above.

## Discord Rich Presence

On desktop, JellyWave shows your currently playing track on your Discord profile, with cover art. It connects to your local Discord client automatically — the one extra step is authorizing the app once via **Settings → Audio → Discord Rich Presence → Connect** (or open [this link](https://discord.com/oauth2/authorize?client_id=1534197353056174180) directly).

Cover art is looked up externally by artist/album rather than pulled from your Jellyfin server, since Discord requires images to be served over HTTPS and most self-hosted Jellyfin setups are plain HTTP/LAN-only.

## Building from source

```bash
npm install
npm start          # run the desktop app
npm run dist        # build a Windows installer
```

The Android project lives in `android/` and is a standard Capacitor project — open it in Android Studio, or build from the command line with `./gradlew assembleRelease` after setting up your own signing keystore in `android/keystore/keystore.properties`.

## Roadmap

Not yet started, roughly in the order they'll likely land:

- Fix session getting logged out on transient network/server errors instead of only on an actual expired token
- Sleep timer (stop playback after N minutes, or at the end of the current track)
- Recently played history view, separate from "recently added"
- Keyboard media key support on desktop (play/pause/skip from your keyboard, not just in-app)
- Smart playlists (auto-generated "most played," "on repeat," genre mixes)
- Swipe gestures on Android track lists (swipe to queue / remove)
- Spotify Connect-style device handoff, letting playback be started on one device and picked up or controlled from another — likely built on Jellyfin's own `/Sessions` remote-control API rather than a custom relay

## Acknowledgements

- [Jellyfin](https://jellyfin.org/) for the media server this app talks to
- [Uicons by Flaticon](https://www.flaticon.com/uicons) for the icon set

## License

MIT
