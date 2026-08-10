// Pin favorite albums to the sidebar for one-click access. There's no
// server-side concept of this in Jellyfin itself, so it's a purely local
// preference -- same localStorage pattern as settings.js/downloads.js.

const STORAGE_KEY = 'jellywave:pinnedAlbums';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (err) {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  } catch (err) {
    // Storage full/unavailable — pins already applied this session still
    // work, they just won't be remembered next launch.
  }
}

let pinned = load();
const listeners = [];

function notify() {
  listeners.forEach((cb) => cb());
}

export function onPinnedAlbumsChange(cb) {
  listeners.push(cb);
}

export function getPinnedAlbums() {
  return pinned;
}

export function isAlbumPinned(id) {
  return pinned.some((a) => a.Id === id);
}

export function togglePinAlbum(album) {
  if (isAlbumPinned(album.Id)) {
    pinned = pinned.filter((a) => a.Id !== album.Id);
  } else {
    // Store only what the sidebar row needs to render + navigate — not
    // the full album item — so this stays small regardless of how many
    // extra fields a given server response happens to carry. AlbumId is
    // kept (even though it's the same as Id for a real album item) since
    // jellyfin.imageUrl() falls back to it when ImageTags carries no
    // usable tag — the pin button on the album page only ever has track
    // data to build from, which has no Primary image tag of its own.
    pinned = [...pinned, { Id: album.Id, Name: album.Name, ImageTags: album.ImageTags || {}, AlbumId: album.AlbumId || album.Id }];
  }
  save();
  notify();
}
