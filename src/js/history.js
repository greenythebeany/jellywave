// Local play history — used for "Recently Played", smart playlists (Most
// Played / On Repeat), and the personal listening stats page. Stored as a
// plain array of lightweight track snapshots (not full Jellyfin item
// objects) so it stays cheap to keep a long tail of entries.

const STORAGE_KEY = 'jellywave:history';
const MAX_ENTRIES = 500;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function save(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    // Storage full/unavailable — history just won't persist this session.
  }
}

let entries = load();

// One row per actual play event (not deduped by track) — needed so repeat
// listens genuinely accumulate for Most Played / On Repeat / the stats page.
// "Recently Played" (below) dedupes its own view on top of this log instead,
// so a song on repeat still shows once there rather than cluttering the list.
export function recordPlay(track) {
  if (!track?.Id) return;
  entries.unshift({
    id: track.Id,
    name: track.Name,
    album: track.Album || '',
    artist: (track.Artists && track.Artists.length ? track.Artists.join(', ') : track.AlbumArtist) || '',
    imageTag: track.ImageTags?.Primary || null,
    albumId: track.AlbumId || null,
    durationTicks: track.RunTimeTicks || 0,
    playedAt: Date.now()
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  save(entries);
}

// Most-recent play of each track, most-recent first — the raw log can have
// several rows per track, so dedupe here rather than at record time.
export function getRecentlyPlayed(limit = 20) {
  const seen = new Set();
  const result = [];
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    result.push(e);
    if (result.length >= limit) break;
  }
  return result;
}

// Play counts across all recorded history, most-played first.
export function getMostPlayed(limit = 20) {
  const counts = new Map();
  for (const e of entries) {
    const existing = counts.get(e.id);
    if (existing) existing.count += 1;
    else counts.set(e.id, { ...e, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

// Tracks played 3+ times within the last 14 days — a rough "on repeat" signal.
export function getOnRepeat(limit = 20) {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const counts = new Map();
  for (const e of entries) {
    if (e.playedAt < cutoff) continue;
    const existing = counts.get(e.id);
    if (existing) existing.count += 1;
    else counts.set(e.id, { ...e, count: 1 });
  }
  return [...counts.values()].filter((e) => e.count >= 3).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function getStats() {
  const totalPlays = entries.length;
  const artistCounts = new Map();
  const trackCounts = new Map();
  const albumCounts = new Map();
  let totalMs = 0;
  for (const e of entries) {
    if (e.artist) artistCounts.set(e.artist, (artistCounts.get(e.artist) || 0) + 1);
    if (e.album) albumCounts.set(e.album, (albumCounts.get(e.album) || 0) + 1);
    trackCounts.set(e.id, (trackCounts.get(e.id) || { ...e, count: 0 }));
    trackCounts.get(e.id).count += 1;
    totalMs += (e.durationTicks || 0) / 10000;
  }
  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([artist, count]) => ({ artist, count }));
  const topAlbums = [...albumCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([album, count]) => ({ album, count }));
  const topTracks = [...trackCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  // Play counts per day for the last 14 days, oldest first — a rough
  // activity chart. This is an estimate: it counts a play at the moment a
  // track started, not how much of it was actually listened to.
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ date: d.getTime(), count: 0 });
  }
  for (const e of entries) {
    const d = new Date(e.playedAt);
    d.setHours(0, 0, 0, 0);
    const bucket = days.find((day) => day.date === d.getTime());
    if (bucket) bucket.count += 1;
  }

  return { totalPlays, totalMinutes: Math.round(totalMs / 60000), topArtists, topAlbums, topTracks, dailyActivity: days };
}
