import { useEffect, useRef, useState } from 'react';

const REPO = 'greenythebeany/jellywave';
const GITHUB = `https://github.com/${REPO}`;
const RELEASES = `${GITHUB}/releases/latest`;
const media = (file) => `${import.meta.env.BASE_URL}media/${file}`;

// Adds the "in" class once an element scrolls into view (one-shot reveal).
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('in');
        io.disconnect();
      }
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// Latest release from the GitHub API, for the version label and direct
// download links. Falls back to the releases page if it can't be reached.
function useLatestRelease() {
  const [release, setRelease] = useState(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setRelease(data))
      .catch(() => {});
  }, []);
  const asset = (test) => release?.assets?.find((a) => test(a.name))?.browser_download_url || RELEASES;
  return {
    version: release?.tag_name || null,
    windows: asset((n) => /setup.*\.exe$/i.test(n)),
    android: asset((n) => /\.apk$/i.test(n)),
    appimage: asset((n) => /\.appimage$/i.test(n)),
    snap: asset((n) => /\.snap$/i.test(n)),
    ipa: asset((n) => /\.ipa$/i.test(n))
  };
}

// "Your music / Your server." typed in the dot-matrix font, like the video.
function Typewriter() {
  const lines = ['Your music', 'Your server'];
  const [shown, setShown] = useState([0, 0]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown([lines[0].length, lines[1].length]);
      setDone(true);
      return undefined;
    }
    let line = 0;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setShown((s) => (line === 0 ? [n, 0] : [s[0], n]));
      if (n >= lines[line].length) {
        if (line === 1) {
          clearInterval(id);
          setTimeout(() => setDone(true), 120);
        }
        line += 1;
        n = 0;
      }
    }, 75);
    return () => clearInterval(id);
  }, []);
  return (
    <h1 className="type" aria-label="Your music. Your server.">
      {lines.map((text, i) => (
        <span className="type-line" key={text} aria-hidden="true">
          {text.slice(0, shown[i])}
          <span className="type-rest">{text.slice(shown[i])}</span>
          {i === 1 && <span className={`red-dot${done ? ' on' : ''}`} />}
          {!done && ((i === 0 && shown[1] === 0) || (i === 1 && shown[1] > 0)) && <span className="caret" />}
        </span>
      ))}
    </h1>
  );
}

function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="#top">
        <img src={media('icon.png')} alt="" width="34" height="34" />
        <span>JellyWave</span>
      </a>
      <div className="nav-links">
        <a href="#styles">Styles</a>
        <a href="#features">Features</a>
        <a href="#download">Download</a>
        <a href={GITHUB} target="_blank" rel="noreferrer" className="nav-gh">GitHub</a>
      </div>
    </nav>
  );
}

function Hero() {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    setMuted(v.muted);
  };
  return (
    <header className="hero" id="top">
      <Typewriter />
      <p className="hero-sub">JellyWave is a free, open-source music app for your own <strong>Jellyfin</strong> server.</p>
      <div className="hero-cta">
        <a className="btn btn-primary" href="#download">Download</a>
        <a className="btn btn-ghost" href={GITHUB} target="_blank" rel="noreferrer">View on GitHub</a>
      </div>
      <div className="hero-video">
        <video
          ref={videoRef}
          src={media('jellywave.mp4')}
          poster={media('poster.jpg')}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <button className="sound-btn" type="button" onClick={toggleSound} aria-label={muted ? 'Play with sound' : 'Mute'}>
          {muted ? <IconMuted /> : <IconSound />}
          <span>{muted ? 'Play with sound' : 'Mute'}</span>
        </button>
      </div>
    </header>
  );
}

const STYLES = [
  { key: 'spotify', label: 'Spotify', desc: 'The familiar dark look: cards, a green accent and big bold type.' },
  { key: 'apple', label: 'Apple Music', desc: 'Frosted glass, bare rounded artwork and slim pill sliders.' },
  { key: 'nothing', label: 'Nothing', desc: 'Black and white with one red accent, dot-matrix type and outline icons.' }
];

function StylesSection() {
  const ref = useReveal();
  const [active, setActive] = useState(0);
  const [sweep, setSweep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % STYLES.length);
      setSweep((s) => s + 1);
    }, 3200);
    return () => clearInterval(id);
  }, [auto]);
  const pick = (i) => {
    setAuto(false);
    if (i !== active) setSweep((s) => s + 1);
    setActive(i);
  };
  return (
    <section className="section reveal" id="styles" ref={ref}>
      <h2>Three looks. <span className="grad">One tap to switch.</span></h2>
      <div className="seg" role="tablist" aria-label="Interface style">
        <span className="seg-pill" style={{ transform: `translateX(${active * 100}%)` }} />
        {STYLES.map((s, i) => (
          <button key={s.key} type="button" role="tab" aria-selected={active === i} className={active === i ? 'on' : ''} onClick={() => pick(i)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="seg-desc" key={active}>{STYLES[active].desc}</p>
      <div className="window">
        {STYLES.map((s, i) => (
          <img
            key={s.key}
            src={media(`desktop-${s.key}.jpg`)}
            alt={`JellyWave desktop app in the ${s.label} style, showing an artist page and lyrics`}
            className="window-layer"
            style={{ clipPath: i <= active ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', zIndex: i }}
            loading="lazy"
          />
        ))}
        <span className="sweep" key={sweep} />
      </div>
    </section>
  );
}

function Phones() {
  const ref = useReveal();
  const [lyrics, setLyrics] = useState(false);
  // Slide the lyrics sheet up a moment after the phones come into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let timer;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      timer = setTimeout(() => setLyrics(true), 1600);
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);
  return (
    <section className="section reveal" ref={ref}>
      <h2>Synced lyrics, <span className="grad">right in your pocket.</span></h2>
      <p className="lead">Lyrics follow the song line by line, from lrclib.net, your own server or lyrics.ovh. Tap the lyrics button for the full sheet.</p>
      <div className="phones">
        <Phone src="phone-apple.jpg" alt="Phone player in the Apple Music style" className="side left" />
        <div className="phone center">
          <div className="screen">
            <span className="island" />
            <img src={media('phone-nothing.jpg')} alt="Phone player in the Nothing style" loading="lazy" />
            <img src={media('phone-nothing-lyrics.jpg')} alt="Full lyrics sheet in the Nothing style" className={`sheet${lyrics ? ' up' : ''}`} loading="lazy" />
            <button type="button" className="lyrics-hit" onClick={() => setLyrics((v) => !v)} aria-label={lyrics ? 'Hide lyrics' : 'Show lyrics'} />
          </div>
        </div>
        <Phone src="phone-spotify.jpg" alt="Phone player in the Spotify style" className="side right" />
      </div>
      <button type="button" className="btn btn-ghost small" onClick={() => setLyrics((v) => !v)}>
        {lyrics ? 'Back to the player' : 'Show the lyrics sheet'}
      </button>
    </section>
  );
}

function Phone({ src, alt, className }) {
  return (
    <div className={`phone ${className}`}>
      <div className="screen">
        <span className="island" />
        <img src={media(src)} alt={alt} loading="lazy" />
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: 'wave', title: 'Gapless & crossfade', text: 'Gapless playback, with an optional 0–12 second crossfade between songs.' },
  { icon: 'level', title: 'ReplayGain', text: 'Even volume across your library, using the loudness data your server already has.' },
  { icon: 'download', title: 'Offline downloads', text: 'Save albums and playlists to your device and keep listening without a connection.' },
  { icon: 'lock', title: 'Lock-screen controls', text: 'Play, pause and skip from the lock screen and notifications, and keep playing in the background.' },
  { icon: 'chart', title: 'Stats & Wrapped', text: 'Real listening time, your top songs and artists, and a year-in-review every December.' },
  { icon: 'brush', title: 'Themes & custom CSS', text: 'Light and dark, a dozen accent colors, community color schemes and your own CSS.' },
  { icon: 'globe', title: '15 languages', text: 'English, Slovak, Czech, German, French, Spanish, Polish and more.' },
  { icon: 'discord', title: 'Discord status', text: 'On desktop, show what you are listening to, cover art included.' }
];

function Features() {
  const ref = useReveal();
  return (
    <section className="section reveal" id="features" ref={ref}>
      <h2>Everything a music app <span className="grad">should do.</span></h2>
      <div className="features">
        {FEATURES.map((f) => (
          <div className="feature" key={f.title}>
            <FeatureIcon name={f.icon} />
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Download() {
  const ref = useReveal();
  const r = useLatestRelease();
  const platforms = [
    { name: 'Windows', file: 'Installer (.exe)', href: r.windows, note: 'Updates itself in the app' },
    { name: 'Android', file: 'APK', href: r.android, note: 'Allow installs from your browser the first time' },
    { name: 'Linux', file: 'AppImage', href: r.appimage, note: 'Or the', extra: { label: '.snap', href: r.snap } },
    { name: 'iPhone', file: 'Unsigned .ipa', href: r.ipa, note: 'Sideload with AltStore or Sideloadly' }
  ];
  return (
    <section className="section reveal" id="download" ref={ref}>
      <h2>Get <span className="grad">JellyWave</span></h2>
      <p className="lead">
        Free and open source. {r.version ? <>Latest version: <span className="mono">{r.version}</span>.</> : 'Grab the latest build.'}
      </p>
      <div className="platforms">
        {platforms.map((p) => (
          <div className="platform" key={p.name}>
            <a className="platform-link" href={p.href}>
              <span className="platform-name">{p.name}</span>
            </a>
            <span className="platform-file">{p.file}</span>
            <span className="platform-note">
              {p.note}
              {p.extra && <> <a className="link" href={p.extra.href}>{p.extra.label}</a></>}
            </span>
            <span className="platform-arrow" aria-hidden="true">↓</span>
          </div>
        ))}
      </div>
      <p className="fine">On first launch, enter your Jellyfin server address and sign in with your Jellyfin account.</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <img src={media('icon.png')} alt="" width="40" height="40" />
        <div>
          <div className="footer-name">JellyWave</div>
          <div className="mono dim">github.com/{REPO}</div>
        </div>
      </div>
      <p className="dim small-text">
        JellyWave is not affiliated with Jellyfin, Spotify, Apple or Nothing. Their names belong to their owners.
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <div className="bg" aria-hidden="true">
        <div className="glow a" />
        <div className="glow b" />
        <div className="grid" />
      </div>
      <Nav />
      <main>
        <Hero />
        <StylesSection />
        <Phones />
        <Features />
        <Download />
      </main>
      <Footer />
    </>
  );
}

// ---------- icons ----------
function IconMuted() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m22 9-6 6M16 9l6 6" />
    </svg>
  );
}
function IconSound() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}
const ICON_PATHS = {
  wave: 'M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0',
  level: 'M4 20V10M10 20V4M16 20v-8M22 20v-4',
  download: 'M12 3v12m0 0-5-5m5 5 5-5M4 21h16',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  brush: 'M14 4l6 6-9 9H5v-6zM13 5l6 6',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  discord: 'M7 7c3-1.5 7-1.5 10 0l2 9c-2 2-4 2.5-5 2.5l-1-2M7 7l-2 9c2 2 4 2.5 5 2.5l1-2M9 13h.01M15 13h.01'
};
function FeatureIcon({ name }) {
  return (
    <span className="feature-icon">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON_PATHS[name]} />
      </svg>
    </span>
  );
}
