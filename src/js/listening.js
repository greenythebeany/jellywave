// Real listening time. Stats used to estimate "time listened" as
// plays x full track length, so a 3-minute song started, paused and
// abandoned still added 3 minutes (Jellyfin also counts short tracks as
// played once you stop past 5%). This measures the seconds actually heard
// instead, per year, per track and per month.
//
// Each device keeps its own log, stored locally and mirrored to the user's
// Jellyfin server under its own key (see JellyfinClient.saveListeningLog),
// so the combined total across devices is a plain sum -- devices never
// overwrite or double-count each other.

const LOCAL_KEY = 'triptych:listening';

function emptyLog() {
  return { v: 1, since: Date.now(), years: {} };
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    return parsed && parsed.v === 1 && parsed.years ? parsed : emptyLog();
  } catch (err) {
    return emptyLog();
  }
}

let log = load();
let dirty = false;

function yearBucket(year) {
  if (!log.years[year]) log.years[year] = { total: 0, tracks: {}, months: new Array(12).fill(0), days: {} };
  if (!log.years[year].days) log.years[year].days = {}; // logs from before the calendar
  return log.years[year];
}

// "MM-DD" key for the per-day totals behind the listening calendar.
export function dayKey(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addListening(trackId, seconds, when = new Date()) {
  if (!trackId || !(seconds > 0)) return;
  const bucket = yearBucket(when.getFullYear());
  bucket.total += seconds;
  bucket.tracks[trackId] = (bucket.tracks[trackId] || 0) + seconds;
  bucket.months[when.getMonth()] += seconds;
  const day = dayKey(when);
  bucket.days[day] = (bucket.days[day] || 0) + seconds;
  dirty = true;
}

// Rounded copy for storage -- fractional seconds add nothing but bytes.
function compact(source) {
  const out = { v: 1, since: source.since, years: {} };
  for (const [year, b] of Object.entries(source.years)) {
    const tracks = {};
    for (const [id, secs] of Object.entries(b.tracks)) {
      if (secs >= 1) tracks[id] = Math.round(secs);
    }
    const days = {};
    for (const [day, secs] of Object.entries(b.days || {})) {
      if (secs >= 1) days[day] = Math.round(secs);
    }
    out.years[year] = { total: Math.round(b.total), tracks, months: b.months.map((m) => Math.round(m)), days };
  }
  return out;
}

export function persistLocal() {
  if (!dirty) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(compact(log)));
  } catch (err) {
    // Storage full -- keep counting in memory, the server copy still syncs.
  }
}

export function getOwnLog() {
  return compact(log);
}

export function isDirty() {
  return dirty;
}

export function markSynced() {
  dirty = false;
}

// After a reinstall the local log starts empty while the server still has
// this device's history -- adopt that instead of starting from zero.
export function adoptIfLarger(serverCopy) {
  if (!serverCopy?.years) return;
  const total = (l) => Object.values(l.years || {}).reduce((sum, b) => sum + (b.total || 0), 0);
  if (total(serverCopy) > total(log)) {
    log = { v: 1, since: serverCopy.since || log.since, years: JSON.parse(JSON.stringify(serverCopy.years)) };
    dirty = true;
    persistLocal();
  }
}

// Sums several device logs (this device's own entry replaced by the live
// in-memory one) into a single { since, years } view.
export function combineLogs(otherLogs) {
  const merged = { since: log.since, years: {} };
  for (const l of [compact(log), ...otherLogs]) {
    if (!l?.years) continue;
    if (l.since && l.since < merged.since) merged.since = l.since;
    for (const [year, b] of Object.entries(l.years)) {
      const m = merged.years[year] || (merged.years[year] = { total: 0, tracks: {}, months: new Array(12).fill(0), days: {} });
      m.total += b.total || 0;
      for (const [id, secs] of Object.entries(b.tracks || {})) m.tracks[id] = (m.tracks[id] || 0) + secs;
      (b.months || []).forEach((secs, i) => { m.months[i] += secs || 0; });
      for (const [day, secs] of Object.entries(b.days || {})) m.days[day] = (m.days[day] || 0) + secs;
    }
  }
  return merged;
}
