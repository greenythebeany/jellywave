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

// Tracks imported from YouTube (see grab.js) keep the video's own title
// verbatim, which often carries extra text past the real song name --
// wrapping quotes, or a trailing " - Show/Game/Album name" segment, e.g.
// `"Just Gold" - Five Nights at Freddy's`. lrclib's search matches fairly
// literally, so that extra text alone was enough to make a real, indexed
// track come back as "no lyrics found". Strips both, for a fallback retry
// only -- see fetchLyrics.
function cleanedTitleForSearch(title) {
  return (title || '')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .split(/\s+[-–—]\s+/)[0]
    .trim();
}

// lrclib intermittently answers 503 (and occasionally just hangs) under
// load. Retry those, bounded by a per-attempt timeout, so a transient blip
// doesn't read as "no lyrics" -- a real 404/empty result is not retried.
const ATTEMPT_TIMEOUT_MS = 8000;
const RETRY_DELAYS_MS = [600, 1600];

// Thrown when lrclib couldn't be reached/answered after all retries --
// distinct from a genuine "no lyrics for this track" (which returns null).
export class LyricsUnavailableError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`lrclib responded ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err; // network error or timeout
    } finally {
      clearTimeout(timer);
    }
  }
  throw new LyricsUnavailableError(lastError?.message || 'Lyrics service unavailable');
}

function toResult(data) {
  return {
    synced: parseLrc(data.syncedLyrics),
    plain: data.plainLyrics || null,
    instrumental: !!data.instrumental
  };
}

async function searchLyrics(title, artist) {
  const searchParams = new URLSearchParams({ track_name: title || '', artist_name: artist || '' });
  const res = await fetchWithRetry(`${LRCLIB_BASE}/search?${searchParams.toString()}`);
  if (!res.ok) return null;
  const results = await res.json();
  return results && results.length ? results[0] : null;
}

async function lookupLyrics({ title, artist, album, durationSeconds }) {
  const params = new URLSearchParams({
    track_name: title || '',
    artist_name: artist || ''
  });
  if (album) params.set('album_name', album);
  if (durationSeconds) params.set('duration', Math.round(durationSeconds));

  // An exact /get miss isn't conclusive (search may still find it), so
  // only a search that actually answered can say "no lyrics" -- any
  // failure along the way surfaces as LyricsUnavailableError instead.
  try {
    const res = await fetchWithRetry(`${LRCLIB_BASE}/get?${params.toString()}`);
    if (res.ok) return toResult(await res.json());
  } catch (err) {
    if (!(err instanceof LyricsUnavailableError)) throw new LyricsUnavailableError(err?.message);
  }

  try {
    let best = await searchLyrics(title, artist);
    if (!best) {
      const cleaned = cleanedTitleForSearch(title);
      if (cleaned && cleaned !== (title || '').trim()) best = await searchLyrics(cleaned, artist);
    }
    return best ? toResult(best) : null;
  } catch (err) {
    throw err instanceof LyricsUnavailableError ? err : new LyricsUnavailableError(err?.message);
  }
}

// In-memory cache (this session only -- nothing is stored), keyed by the
// lookup itself: found lyrics and confirmed "none" are kept, so revisiting
// a track is instant; failures aren't, so the next view retries. Also
// dedupes concurrent lookups of the same track (prefetch + display).
const cache = new Map();
const inFlight = new Map();

function cacheKey({ title, artist, album, durationSeconds }) {
  return [title, artist, album, Math.round(durationSeconds || 0)].map((v) => (v ?? '')).join('\u0001').toLowerCase();
}

export function getCachedLyrics(query) {
  const key = cacheKey(query);
  return cache.has(key) ? { hit: true, value: cache.get(key) } : { hit: false };
}

export async function fetchLyrics(query) {
  const key = cacheKey(query);
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = lookupLyrics(query)
    .then((result) => {
      cache.set(key, result);
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
