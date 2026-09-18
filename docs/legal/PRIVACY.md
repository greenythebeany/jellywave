# Privacy Policy

_Last updated: 2026-09-18_

JellyWave is a client app for a Jellyfin media server **you host yourself**. The developer does not run any backend for JellyWave, does not receive analytics or telemetry from your copy of the app, and cannot see your library, your account, or what you play.

JellyWave is a free, open-source (MIT-licensed) personal project maintained by one developer (GitHub: [greenythebeany](https://github.com/greenythebeany)). There is no company behind it. The only contact channel is [GitHub Issues on the jellywave repo](https://github.com/greenythebeany/jellywave/issues) — that's also where to report a privacy, accessibility, or licensing concern.

This document is also available inside the app itself, under **Settings → About → Legal**.

## Data that stays on your device

- **Your Jellyfin session** (server address, username, access token) — saved to a local file (`session.dat` in JellyWave's app-data folder) using your OS's encryption (Electron `safeStorage`) when the OS supports it. If your OS doesn't support that encryption, the file is saved as plain text instead — worth knowing if your device disk itself isn't encrypted.
- **App preferences** (theme, language, audio settings, etc.) — stored in local browser storage on desktop, and via the Capacitor Preferences plugin on Android. These also sync to your own Jellyfin server's user-data store so they follow you between your own devices — that sync target is your server, never the developer.
- **Downloaded tracks** — saved as ordinary audio files in JellyWave's app-data folder for offline playback.
- **Listening stats** (top artists/tracks, play history) — computed from your local playback and stored the same way as preferences, above.

## Data sent to other services (never to the developer)

- **Your own Jellyfin server** — the app talks to it directly with your credentials to stream your library. This is infrastructure you control.
- **GitHub (api.github.com)** — a background check for a newer JellyWave release. Sends a generic app identifier, nothing that identifies you. Can be turned off in Settings → Privacy.
- **Deezer (api.deezer.com)** — when your server has no cover art for a track, the current artist/album/track name is sent to Deezer's public search to find one. No account or personal identifier is sent. Can be turned off in Settings → Privacy.
- **Discord** — only if you explicitly connect it in Settings → Audio → Discord Rich Presence. While connected, the currently playing track/artist and its cover art URL are sent to your local Discord client so it can show on your Discord profile. Off by default; disconnect any time.
- **YouTube / YouTube Music / SoundCloud** — only if you use the "Import" feature to paste a link, which fetches that specific media directly to your device. See the [Terms of Service](TERMS.md) for the responsibility that comes with this feature.

## Children's data

JellyWave has no sign-up, no account creation of its own, and no data collection by the developer, so there's nothing here that depends on a user's age — the developer never receives personal data regardless of who's using the app. That said, JellyWave is not directed at children, and using it requires access to a Jellyfin server, which should be set up and supervised by an adult.

## Email

JellyWave does not send email, does not run a mailing list, and does not collect email addresses. There's no "unsubscribe" link anywhere because no such messages exist.

## Related documents

- [Terms of Service](TERMS.md)
- [Refund Policy](REFUNDS.md)
- [Cookie & Local Storage Policy](COOKIES.md)
- [Data Deletion](DATA_DELETION.md)
- [Third-Party Notices & Licenses](THIRD_PARTY_NOTICES.md)
- [Accessibility Statement](ACCESSIBILITY.md)
