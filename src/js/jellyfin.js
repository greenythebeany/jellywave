// Minimal Jellyfin REST API client — just what a music client needs.

// Must be unique per install, not per app — the Connect feature (Sessions
// API) tells devices apart by DeviceId, and a shared constant here would
// make every JellyWave install look like the same device reconnecting,
// breaking both the "other devices" list and self-exclusion from it.
const DEVICE_ID_KEY = 'jellywave:deviceId';
function loadOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `jellywave-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (err) {
    return `jellywave-${Math.random().toString(36).slice(2)}`;
  }
}
const DEVICE_ID = loadOrCreateDeviceId();
const CLIENT_NAME = 'JellyWave';
const CLIENT_VERSION = '1.0.0';

function authHeader(token) {
  let header = `MediaBrowser Client="${CLIENT_NAME}", Device="Desktop", DeviceId="${DEVICE_ID}", Version="${CLIENT_VERSION}"`;
  if (token) header += `, Token="${token}"`;
  return header;
}

export class JellyfinClient {
  constructor({ serverUrl, accessToken, userId, avatarTag }) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.accessToken = accessToken;
    this.userId = userId;
    this.avatarTag = avatarTag || null;
  }

  static async authenticate(serverUrl, username, password) {
    const base = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': authHeader()
      },
      body: JSON.stringify({ Username: username, Pw: password })
    });

    if (!res.ok) {
      if (res.status === 401) {
        const err = new Error('Wrong username or password.');
        err.code = 'wrong_credentials';
        throw err;
      }
      const err = new Error(`Server responded with ${res.status}.`);
      err.code = 'server_error';
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return {
      serverUrl: base,
      accessToken: data.AccessToken,
      userId: data.User.Id,
      username: data.User.Name,
      avatarTag: data.User.PrimaryImageTag || null
    };
  }

  avatarUrl(maxSize = 120) {
    if (!this.avatarTag) return null;
    const params = new URLSearchParams({
      maxWidth: maxSize,
      maxHeight: maxSize,
      quality: 90,
      tag: this.avatarTag,
      api_key: this.accessToken
    });
    return `${this.serverUrl}/Users/${this.userId}/Images/Primary?${params.toString()}`;
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': authHeader(this.accessToken),
      'X-Emby-Token': this.accessToken
    };
  }

  async _get(path, params = {}) {
    const url = new URL(`${this.serverUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    let res;
    try {
      res = await fetch(url, { headers: this._headers() });
    } catch (err) {
      // fetch itself threw — no response at all (offline, DNS, server down,
      // etc). Distinct from an actual HTTP error response.
      const netErr = new Error(`Could not reach server: ${err.message}`);
      netErr.isNetworkError = true;
      throw netErr;
    }
    if (!res.ok) {
      const err = new Error(`Jellyfin request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Hits an authenticated endpoint so a stale/invalid saved token is caught
  // here and sent back to the login screen, instead of silently proceeding
  // into a half-logged-in app that breaks on the first real request.
  async ping() {
    return this._get('/Users/Me');
  }

  async getMusicLibraries() {
    const data = await this._get(`/Users/${this.userId}/Views`);
    return (data.Items || []).filter((item) => item.CollectionType === 'music');
  }

  async getAllSongs(parentId) {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      ParentId: parentId,
      IncludeItemTypes: 'Audio',
      Recursive: true,
      SortBy: 'Album,SortName',
      SortOrder: 'Ascending',
      Fields: 'PrimaryImageAspectRatio,MediaSources,AlbumArtist,ArtistItems,UserData,Genres,NormalizationGain'
    });
    return data.Items || [];
  }

  async getAlbums(parentId) {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      ParentId: parentId,
      IncludeItemTypes: 'MusicAlbum',
      Recursive: true,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      Fields: 'PrimaryImageAspectRatio,AlbumArtist'
    });
    return data.Items || [];
  }

  async getAlbumsByArtist(artistId) {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      ArtistIds: artistId,
      IncludeItemTypes: 'MusicAlbum',
      Recursive: true,
      SortBy: 'PremiereDate,SortName',
      SortOrder: 'Ascending',
      Fields: 'PrimaryImageAspectRatio,AlbumArtist'
    });
    return data.Items || [];
  }

  async getSongsByArtist(artistId) {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      ArtistIds: artistId,
      IncludeItemTypes: 'Audio',
      Recursive: true,
      SortBy: 'Album,SortName',
      SortOrder: 'Ascending',
      Fields: 'PrimaryImageAspectRatio,MediaSources,AlbumArtist,ArtistItems,UserData,Genres,NormalizationGain'
    });
    return data.Items || [];
  }

  async getAlbumTracks(albumId) {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      ParentId: albumId,
      IncludeItemTypes: 'Audio',
      SortBy: 'ParentIndexNumber,IndexNumber',
      SortOrder: 'Ascending',
      Fields: 'MediaSources,ArtistItems,UserData,Genres,NormalizationGain'
    });
    return data.Items || [];
  }

  async getArtists(parentId) {
    const data = await this._get(`/Artists`, {
      ParentId: parentId,
      Recursive: true,
      SortBy: 'SortName',
      Fields: 'PrimaryImageAspectRatio'
    });
    const items = data.Items || [];
    // Jellyfin can list the same artist once per library section it appears in —
    // collapse those into a single card by normalized name.
    const seen = new Map();
    for (const item of items) {
      const key = (item.Name || '').trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, item);
    }
    return [...seen.values()];
  }

  async getPlaylists() {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      IncludeItemTypes: 'Playlist',
      Recursive: true,
      SortBy: 'SortName',
      Fields: 'PrimaryImageAspectRatio'
    });
    return data.Items || [];
  }

  async getItem(itemId) {
    return this._get(`/Users/${this.userId}/Items/${itemId}`);
  }

  async getPlaylistItems(playlistId) {
    const data = await this._get(`/Playlists/${playlistId}/Items`, {
      UserId: this.userId,
      Fields: 'MediaSources,ArtistItems,UserData,Genres,NormalizationGain'
    });
    return data.Items || [];
  }

  async createPlaylist(name) {
    const res = await fetch(`${this.serverUrl}/Playlists`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ Name: name, UserId: this.userId, MediaType: 'Audio', Ids: [] })
    });
    if (!res.ok) throw new Error(`Could not create playlist (${res.status}).`);
    return res.json();
  }

  async addToPlaylist(playlistId, itemId) {
    const params = new URLSearchParams({ Ids: itemId, UserId: this.userId });
    const res = await fetch(`${this.serverUrl}/Playlists/${playlistId}/Items?${params.toString()}`, {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not add song to playlist (${res.status}).`);
  }

  // entryId is the playlist-entry id (PlaylistItemId from getPlaylistItems),
  // not the underlying song's own Id — needed so removing one occurrence of
  // a song that appears twice in the same playlist removes only that one.
  async removeFromPlaylist(playlistId, entryId) {
    const params = new URLSearchParams({ entryIds: entryId });
    const res = await fetch(`${this.serverUrl}/Playlists/${playlistId}/Items?${params.toString()}`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not remove song from playlist (${res.status}).`);
  }

  async uploadPlaylistImage(playlistId, file) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch(`${this.serverUrl}/Items/${playlistId}/Images/Primary`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'X-Emby-Authorization': authHeader(this.accessToken),
        'X-Emby-Token': this.accessToken
      },
      body: base64
    });
    if (!res.ok) throw new Error(`Could not upload image (${res.status}).`);
  }

  async getLikedSongs() {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      Filters: 'IsFavorite',
      IncludeItemTypes: 'Audio',
      Recursive: true,
      SortBy: 'SortName',
      Fields: 'PrimaryImageAspectRatio,MediaSources,ArtistItems,UserData,Genres,NormalizationGain'
    });
    return data.Items || [];
  }

  async likeItem(itemId) {
    const res = await fetch(`${this.serverUrl}/Users/${this.userId}/FavoriteItems/${itemId}`, {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not like song (${res.status}).`);
  }

  // Marks an item played server-side (increments UserData.PlayCount, bumps
  // LastPlayedDate) — the standard Jellyfin endpoint real clients call on
  // finishing a track. Since UserData travels with the account, not the
  // device, this is what makes play counts/stats follow the user across
  // devices instead of living in this one browser's local storage.
  async markPlayed(itemId) {
    const res = await fetch(`${this.serverUrl}/Users/${this.userId}/PlayedItems/${itemId}`, {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not mark item played (${res.status}).`);
    return res.json();
  }

  async unlikeItem(itemId) {
    const res = await fetch(`${this.serverUrl}/Users/${this.userId}/FavoriteItems/${itemId}`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not unlike song (${res.status}).`);
  }

  async getMusicGenres() {
    const data = await this._get(`/MusicGenres`, {
      UserId: this.userId,
      SortBy: 'SortName',
      Fields: 'PrimaryImageAspectRatio'
    });
    return data.Items || [];
  }

  async getSongsByGenre(genreId) {
    const data = await this._get(`/Users/${this.userId}/Items`, {
      GenreIds: genreId,
      IncludeItemTypes: 'Audio',
      Recursive: true,
      SortBy: 'Album,SortName',
      Fields: 'PrimaryImageAspectRatio,MediaSources,AlbumArtist,ArtistItems,UserData,Genres,NormalizationGain'
    });
    return data.Items || [];
  }

  async search(term) {
    // MusicArtist entities aren't reachable through the generic recursive
    // Items search the way songs/albums/playlists are — they need /Artists.
    const [itemsData, artistsData] = await Promise.all([
      this._get(`/Users/${this.userId}/Items`, {
        SearchTerm: term,
        IncludeItemTypes: 'Audio,MusicAlbum,Playlist',
        Recursive: true,
        Limit: 30,
        Fields: 'PrimaryImageAspectRatio,UserData'
      }),
      this._get(`/Artists`, {
        SearchTerm: term,
        Recursive: true,
        Limit: 20,
        Fields: 'PrimaryImageAspectRatio'
      })
    ]);
    return [...(artistsData.Items || []), ...(itemsData.Items || [])];
  }

  // ---------- Connect (Sessions API remote control) ----------

  get deviceId() {
    return DEVICE_ID;
  }

  wsUrl() {
    const wsBase = this.serverUrl.replace(/^http/, 'ws');
    const params = new URLSearchParams({ api_key: this.accessToken, deviceId: DEVICE_ID });
    return `${wsBase}/socket?${params.toString()}`;
  }

  // Sessions this user is allowed to remote-control, excluding this device's
  // own session — that's the actual device list a "Connect" picker shows.
  async getSessions() {
    const data = await this._get('/Sessions', { ControllableByUserId: this.userId });
    return (data || []).filter((s) => s.DeviceId !== DEVICE_ID);
  }

  async sendPlayCommand(sessionId, itemIds, startPositionTicks = 0) {
    const params = new URLSearchParams({
      ItemIds: Array.isArray(itemIds) ? itemIds.join(',') : itemIds,
      StartPositionTicks: String(Math.round(startPositionTicks)),
      PlayCommand: 'PlayNow'
    });
    const res = await fetch(`${this.serverUrl}/Sessions/${sessionId}/Playing?${params.toString()}`, {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not start playback on that device (${res.status}).`);
  }

  // command: one of Jellyfin's PlaystateCommand values — Stop, Pause,
  // Unpause, NextTrack, PreviousTrack, Seek (needs SeekPositionTicks).
  async sendPlaystateCommand(sessionId, command, extraParams = {}) {
    const qs = new URLSearchParams(extraParams).toString();
    const res = await fetch(`${this.serverUrl}/Sessions/${sessionId}/Playing/${command}${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(`Could not send command (${res.status}).`);
  }

  // Self-reporting so this device shows up as "Now Playing" and is
  // controllable to other Jellyfin clients — the counterpart to
  // getSessions()/sendPlayCommand() on the controlling side. Best-effort:
  // failures here shouldn't interrupt local playback, so callers swallow errors.
  async reportPlaybackStart(payload) {
    const res = await fetch(`${this.serverUrl}/Sessions/Playing`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Could not report playback start (${res.status}).`);
  }

  async reportPlaybackProgress(payload) {
    const res = await fetch(`${this.serverUrl}/Sessions/Playing/Progress`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Could not report playback progress (${res.status}).`);
  }

  async reportPlaybackStopped(payload) {
    const res = await fetch(`${this.serverUrl}/Sessions/Playing/Stopped`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Could not report playback stop (${res.status}).`);
  }

  imageUrl(item, type = 'Primary', maxSize = 500) {
    const tag = item.ImageTags && item.ImageTags[type];
    const id = tag ? item.Id : item.AlbumId; // fall back to album art for tracks without their own art
    if (!tag && !item.AlbumId) return null;
    const params = new URLSearchParams({ maxWidth: maxSize, maxHeight: maxSize, quality: 90 });
    if (tag) params.set('tag', tag);
    return `${this.serverUrl}/Items/${id}/Images/${type}?${params.toString()}`;
  }

  // bitrateKbps: omit (or 0) for direct play at source quality; otherwise the
  // server transcodes down to that ceiling — useful on slow/metered connections.
  streamUrl(item, bitrateKbps = 0) {
    if (!bitrateKbps) {
      const params = new URLSearchParams({
        static: 'true',
        api_key: this.accessToken,
        deviceId: DEVICE_ID
      });
      return `${this.serverUrl}/Audio/${item.Id}/stream?${params.toString()}`;
    }
    const params = new URLSearchParams({
      audioCodec: 'mp3',
      audioBitRate: String(bitrateKbps * 1000),
      api_key: this.accessToken,
      deviceId: DEVICE_ID
    });
    return `${this.serverUrl}/Audio/${item.Id}/stream.mp3?${params.toString()}`;
  }
}
