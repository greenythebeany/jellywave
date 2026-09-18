# Data Deletion

_Last updated: 2026-09-18_

Because the developer never receives or stores your data in the first place, there is nothing for the developer to delete on your behalf. Deleting it means clearing what's on your own device and your own server:

- **On this device** — Settings → Log Out clears your saved session immediately. Uninstalling JellyWave (or deleting its app-data folder — on Windows, typically `%APPDATA%\JellyWave`) removes all local settings, downloads, and cached data.
- **Synced settings/stats on your Jellyfin server** — since these live in your own server's user-data store, delete them from your Jellyfin server directly (its admin dashboard or database), the same as any other Jellyfin client's data. The developer has no access to your server and cannot delete anything on it.

Questions about this can be raised via [GitHub Issues](https://github.com/greenythebeany/jellywave/issues).
