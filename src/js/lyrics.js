// Fetches lyrics at runtime from lrclib.net, a free, open lyrics lookup API.
// Nothing is bundled or stored — this only looks up what the user is currently playing.

const LRCLIB_BASE = 'https://lrclib.net/api';

function parseLrc(lrc) {
  if (!lrc) return null;
  const lines = lrc.split('\n');
  const timeTag = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const result = [];

  for (const line of lines) {
    const tags = [...line.matchAll(timeTag)];
    if (tags.length === 0) continue;
    const text = line.replace(timeTag, '').trim();
    for (const tag of tags) {
      const minutes = parseInt(tag[1], 10);
      const seconds = parseInt(tag[2], 10);
      const fraction = tag[3] ? parseInt(tag[3].padEnd(3, '0'), 10) / 1000 : 0;
      const time = minutes * 60 + seconds + fraction;
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics({ title, artist, album, durationSeconds }) {
  const params = new URLSearchParams({
    track_name: title || '',
    artist_name: artist || ''
  });
  if (album) params.set('album_name', album);
  if (durationSeconds) params.set('duration', Math.round(durationSeconds));

  try {
    const res = await fetch(`${LRCLIB_BASE}/get?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        synced: parseLrc(data.syncedLyrics),
        plain: data.plainLyrics || null,
        instrumental: !!data.instrumental
      };
    }
  } catch (err) {
    // fall through to search
  }

  try {
    const searchParams = new URLSearchParams({
      track_name: title || '',
      artist_name: artist || ''
    });
    const res = await fetch(`${LRCLIB_BASE}/search?${searchParams.toString()}`);
    if (!res.ok) return null;
    const results = await res.json();
    if (!results || results.length === 0) return null;
    const best = results[0];
    return {
      synced: parseLrc(best.syncedLyrics),
      plain: best.plainLyrics || null,
      instrumental: !!best.instrumental
    };
  } catch (err) {
    return null;
  }
}
