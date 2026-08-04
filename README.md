<p align="center">
  <img src="logo.png" width="140" alt="JellyWave logo" />
</p>

<h1 align="center">JellyWave</h1>
<p align="center">A sleek, Spotify-styled music client for your own Jellyfin server.</p>

<p align="center">
  <a href="https://github.com/greenythebeany/jellywave/releases/latest">Download</a>
</p>

---

JellyWave is a personal music client for a self-hosted Jellyfin server. It logs into your own server with your own library and gives you a modern, Spotify-like listening experience across desktop and Android, without any of the server-side bloat of a general-purpose media app.

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

| Theme | `@import` line |
| --- | --- |
| Catppuccin Mocha | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-mocha.css');` |
| Catppuccin Macchiato | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-macchiato.css');` |
| Catppuccin Frappé | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-frappe.css');` |
| Catppuccin Latte | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/catppuccin-latte.css');` |
| Dracula | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/dracula.css');` |
| Nord | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/nord.css');` |
| Gruvbox Dark | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/gruvbox-dark.css');` |
| Gruvbox Light | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/gruvbox-light.css');` |
| Tokyo Night | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/tokyonight.css');` |
| Rosé Pine | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/rose-pine.css');` |
| Rosé Pine Moon | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/rose-pine-moon.css');` |
| Rosé Pine Dawn | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/rose-pine-dawn.css');` |
| Kanagawa | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/kanagawa.css');` |
| Solarized Dark | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/solarized-dark.css');` |
| Solarized Light | `@import url('https://cdn.jsdelivr.net/gh/greenythebeany/jellywave@main/src/themes/solarized-light.css');` |

The theme source files live in [`src/themes/`](src/themes/) if you want to tweak one or build your own — they just override the app's existing CSS custom properties (background, text, and accent colors).

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

**v1.0.1** is planned to add Spotify Connect-style device handoff, letting playback be started on one device and picked up or controlled from another. Not yet started.

## Acknowledgements

- [Jellyfin](https://jellyfin.org/) for the media server this app talks to
- [Uicons by Flaticon](https://www.flaticon.com/uicons) for the icon set

## License

MIT
