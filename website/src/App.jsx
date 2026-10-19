import { useEffect, useRef, useState } from 'react';

const REPO = 'greenythebeany/jellywave';
const GITHUB = `https://github.com/${REPO}`;
const RELEASES = `${GITHUB}/releases/latest`;
const PRIVACY = `${GITHUB}/blob/main/docs/legal/PRIVACY.md`;
const JELLYFIN = 'https://jellyfin.org/downloads/server';
const media = (file) => `${import.meta.env.BASE_URL}media/${file}`;

// Adds the "in" class once an element scrolls into view (one-shot reveal).
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('in');
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
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

// Section heading: mono index label + dot-matrix title ending in the red dot.
function Heading({ index, label, children }) {
  return (
    <div className="heading">
      <div className="label"><span className="label-index">{index}</span>{label}</div>
      <h2>{children}<span className="rdot" aria-hidden="true" /></h2>
    </div>
  );
}

// "Your music / Your server." typed in the dot-matrix font, like the video.
function Typewriter() {
  const lines = ['Your music', 'Your server'];
  const [shown, setShown] = useState([0, 0]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
          {i === 1 && <span className={`rdot big${done ? ' on' : ''}`} />}
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
        <img src={media('icon.png')} alt="" width="30" height="30" />
        <span>JellyWave</span>
      </a>
      <div className="nav-links">
        <a href="#what">What it is</a>
        <a href="#how">How it works</a>
        <a href="#looks">Looks</a>
        <a href="#faq">FAQ</a>
        <a href="#download" className="pill">Download</a>
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
      <div className="label hero-label">Music app for Jellyfin</div>
      <Typewriter />
      <p className="hero-sub">
        JellyWave plays the music <em>you own</em>. Keep your songs on your own Jellyfin server, and listen
        to them on your computer and phone in an app that feels like Spotify or Apple Music. No subscription, no ads.
      </p>
      <div className="hero-cta">
        <a className="btn btn-white" href="#download">Download JellyWave</a>
        <a className="btn btn-line" href="#how">How it works</a>
      </div>
      <div className="hero-video">
        <video ref={videoRef} src={media('jellywave.mp4')} poster={media('poster.jpg')} autoPlay muted loop playsInline preload="auto" />
        <button className="sound-btn" type="button" onClick={toggleSound}>
          <span className={`sound-dot${muted ? '' : ' on'}`} />
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>
    </header>
  );
}

// ---------- 01: what it is ----------
function What() {
  const ref = useReveal();
  return (
    <section className="section reveal" id="what" ref={ref}>
      <Heading index="01" label="What is JellyWave">A player for your own music</Heading>
      <p className="lead">
        Streaming apps rent you music. JellyWave plays the files you already have: your MP3s and FLACs, ripped CDs,
        old downloads. It works together with <a href="https://jellyfin.org" target="_blank" rel="noreferrer">Jellyfin</a>,
        free software that keeps your library on a computer you control.
      </p>
      <div className="flow">
        <div className="flow-card">
          <div className="flow-num">A</div>
          <IconFiles />
          <h3>Your music files</h3>
          <p>Albums and songs on your computer, NAS or home server.</p>
        </div>
        <div className="flow-link" aria-hidden="true"><span /></div>
        <div className="flow-card">
          <div className="flow-num">B</div>
          <IconServer />
          <h3>Jellyfin server</h3>
          <p>Free software that organizes them and streams them to your devices.</p>
        </div>
        <div className="flow-link" aria-hidden="true"><span /></div>
        <div className="flow-card accent">
          <div className="flow-num">C</div>
          <img src={media('icon.png')} alt="" className="flow-logo" />
          <h3>JellyWave</h3>
          <p>The app you listen with, on Windows, Linux, Android and iPhone.</p>
        </div>
      </div>
    </section>
  );
}

// ---------- 02: how it works, step by step ----------
function How() {
  const ref = useReveal(0.08);
  return (
    <section className="section reveal" id="how" ref={ref}>
      <Heading index="02" label="How it works">Up and running in three steps</Heading>
      <div className="steps">
        <div className="step">
          <div className="step-text">
            <div className="step-num">Step 1</div>
            <h3>Put your music on Jellyfin</h3>
            <p>
              Install Jellyfin on a computer that stays on (a PC, a NAS or a small server) and point it at your music folder.
              It reads your tags and cover art and builds the library. Already running Jellyfin? Skip ahead.
            </p>
            <a className="btn btn-line small" href={JELLYFIN} target="_blank" rel="noreferrer">Get Jellyfin (free)</a>
          </div>
          <div className="step-visual">
            <div className="tree" aria-label="Example music folder">
              <div className="tree-head"><span className="tree-dot" />Music</div>
              <div className="tree-row d1">Slipknot</div>
              <div className="tree-row d2">We Are Not Your Kind</div>
              <div className="tree-row d3 file">01 Insert Coin.flac</div>
              <div className="tree-row d3 file on">02 Unsainted.flac</div>
              <div className="tree-row d3 file">03 Birth of the Cruel.flac</div>
              <div className="tree-row d1">Elán</div>
              <div className="tree-row d1 more">…</div>
            </div>
          </div>
        </div>

        <div className="step">
          <div className="step-text">
            <div className="step-num">Step 2</div>
            <h3>Install JellyWave</h3>
            <p>
              Download it for your devices: an installer for Windows, an APK for Android, an AppImage or snap for Linux,
              and an .ipa you can sideload on iPhone. Install it on as many devices as you like.
            </p>
            <a className="btn btn-line small" href="#download">See all downloads</a>
          </div>
          <div className="step-visual">
            <div className="platform-stack">
              {['Windows', 'Android', 'Linux', 'iPhone'].map((p, i) => (
                <div className="platform-chip" key={p} style={{ '--i': i }}>
                  <span className="chip-dot" />{p}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="step">
          <div className="step-text">
            <div className="step-num">Step 3</div>
            <h3>Sign in and press play</h3>
            <p>
              Open JellyWave, type your server's address and your Jellyfin username and password. Your whole library shows up:
              artists, albums, playlists and liked songs. Your settings follow you to every device.
            </p>
          </div>
          <div className="step-visual phones-pair">
            <Phone src="phone-login.jpg" alt="JellyWave sign-in screen with an example server address" />
            <Phone src="phone-nothing-home.jpg" alt="An artist page in JellyWave after signing in" className="lift" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 03: three looks ----------
const STYLES = [
  { key: 'spotify', label: 'Spotify', desc: 'The familiar dark look: cards, a green accent and big bold type.' },
  { key: 'apple', label: 'Apple Music', desc: 'Frosted glass, bare rounded artwork and slim pill sliders.' },
  { key: 'nothing', label: 'Nothing', desc: 'Black and white with one red accent, dot-matrix type and outline icons.' }
];

function Looks() {
  const ref = useReveal();
  const [active, setActive] = useState(0);
  const [sweep, setSweep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % STYLES.length);
      setSweep((s) => s + 1);
    }, 3400);
    return () => clearInterval(id);
  }, [auto]);
  const pick = (i) => {
    setAuto(false);
    if (i !== active) setSweep((s) => s + 1);
    setActive(i);
  };
  return (
    <section className="section reveal" id="looks" ref={ref}>
      <Heading index="03" label="Make it yours">Three looks, one tap to switch</Heading>
      <p className="lead">Pick the style you like in Settings. Each one restyles the whole app, on desktop and phone, and you can pick your own accent color too.</p>
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
            alt={`JellyWave on desktop in the ${s.label} style, on an artist page with lyrics on the right`}
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

// ---------- 04: on your phone ----------
function Pocket() {
  const ref = useReveal();
  const [lyrics, setLyrics] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let timer;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      timer = setTimeout(() => setLyrics(true), 1800);
      io.disconnect();
    }, { threshold: 0.45 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);
  return (
    <section className="section reveal" ref={ref}>
      <Heading index="04" label="In your pocket">Made for listening</Heading>
      <div className="pocket">
        <div className="pocket-list">
          <Point title="Synced lyrics">Lines light up with the song, from lrclib.net, your own server or lyrics.ovh.</Point>
          <Point title="Offline downloads">Save albums and playlists to your phone and listen without a connection.</Point>
          <Point title="Lock-screen controls">Play, pause and skip from the lock screen. Music keeps playing in the background.</Point>
          <Point title="A real queue">Songs you add play in order, before the rest of the album. Drag to reorder, swipe to remove.</Point>
          <button type="button" className="btn btn-line small" onClick={() => setLyrics((v) => !v)}>
            {lyrics ? 'Back to the player' : 'Open the lyrics sheet'}
          </button>
        </div>
        <div className="phone big">
          <div className="screen">
            <span className="island" />
            <img src={media('phone-nothing.jpg')} alt="The full-screen player on a phone, Nothing style" loading="lazy" />
            <img src={media('phone-nothing-lyrics.jpg')} alt="The full lyrics sheet" className={`sheet${lyrics ? ' up' : ''}`} loading="lazy" />
            <button type="button" className="lyrics-hit" onClick={() => setLyrics((v) => !v)} aria-label={lyrics ? 'Hide lyrics' : 'Show lyrics'} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Point({ title, children }) {
  return (
    <div className="point">
      <span className="point-dot" />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}

function Phone({ src, alt, className = '' }) {
  return (
    <div className={`phone ${className}`}>
      <div className="screen">
        <span className="island" />
        <img src={media(src)} alt={alt} loading="lazy" />
      </div>
    </div>
  );
}

// ---------- 05: everything else ----------
const FEATURES = [
  ['Gapless & crossfade', 'Gapless playback, with an optional 0–12 second crossfade between songs.'],
  ['ReplayGain', 'Even volume across your library, using loudness data your server already has.'],
  ['Stats & Wrapped', 'Real listening time, your top songs and artists, and a year in review every December.'],
  ['Equalizer', 'A five-band EQ with presets, and a loudness boost on Android.'],
  ['Themes & custom CSS', 'Light and dark, a dozen accent colors, community color schemes, or your own CSS.'],
  ['Discord status', 'On desktop, show what you are listening to, cover art included.'],
  ['Cast & sleep timer', 'Send playback to other Jellyfin devices, or stop the music after a set time.'],
  ['15 languages', 'English, Slovak, Czech, German, French, Spanish, Polish and more.']
];

function Features() {
  const ref = useReveal();
  return (
    <section className="section reveal" id="features" ref={ref}>
      <Heading index="05" label="And the rest">Everything else you'd expect</Heading>
      <div className="features">
        {FEATURES.map(([title, text], i) => (
          <div className="feature" key={title}>
            <div className="feature-num">{String(i + 1).padStart(2, '0')}</div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- 06: FAQ ----------
const FAQ = [
  ['Is JellyWave free?', 'Yes. It is free and open source, with no subscription, ads or account of ours to sign up for.'],
  ['Do I need a Jellyfin server?', 'Yes. JellyWave plays music from a Jellyfin server, and does not include music of its own. Jellyfin is free too, and runs on Windows, macOS, Linux and most NAS boxes.'],
  ['Can I play Spotify or Apple Music songs with it?', 'No. JellyWave plays music files you own that are on your Jellyfin server. The Spotify, Apple Music and Nothing options only change how the app looks.'],
  ['Does it work away from home?', 'Yes, as long as your phone can reach your server, for example through a VPN like Tailscale or a public address. Songs you download play with no connection at all.'],
  ['What happens to my data?', 'Your library and listening history stay on your device and your own server. A few optional lookups (missing cover art, lyrics and update checks) talk to outside services, and the Privacy Policy lists exactly what is sent.'],
  ['Which devices are supported?', 'Windows, Linux, Android and iPhone. On iPhone the app is installed by sideloading an unsigned .ipa, for example with AltStore or Sideloadly.']
];

function Faq() {
  const ref = useReveal();
  return (
    <section className="section reveal" id="faq" ref={ref}>
      <Heading index="06" label="Questions">Good to know</Heading>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}<span className="faq-plus" aria-hidden="true" /></summary>
            <p>{a}{q.startsWith('What happens') && <> <a href={PRIVACY} target="_blank" rel="noreferrer">Read the Privacy Policy</a>.</>}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------- 07: download ----------
function Download() {
  const ref = useReveal();
  const r = useLatestRelease();
  const platforms = [
    { name: 'Windows', file: 'Installer · .exe', href: r.windows, note: 'Updates itself from inside the app.' },
    { name: 'Android', file: 'APK', href: r.android, note: 'Allow installs from your browser the first time.' },
    { name: 'Linux', file: 'AppImage', href: r.appimage, note: 'Also available as a', extra: { label: '.snap', href: r.snap } },
    { name: 'iPhone', file: 'Unsigned .ipa', href: r.ipa, note: 'Sideload with AltStore or Sideloadly.' }
  ];
  return (
    <section className="section reveal" id="download" ref={ref}>
      <Heading index="07" label={r.version ? `Latest · ${r.version}` : 'Latest release'}>Get JellyWave</Heading>
      <div className="platforms">
        {platforms.map((p) => (
          <div className="platform" key={p.name}>
            <a className="platform-link" href={p.href}><span className="platform-name">{p.name}</span></a>
            <span className="platform-file">{p.file}</span>
            <span className="platform-note">
              {p.note}
              {p.extra && <> <a className="link" href={p.extra.href}>{p.extra.label}</a>.</>}
            </span>
            <span className="platform-arrow" aria-hidden="true"><IconDown /></span>
          </div>
        ))}
      </div>
      <p className="fine">After installing: open JellyWave, enter your Jellyfin server address, and sign in. That's it.</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <img src={media('icon.png')} alt="" width="36" height="36" />
        <div>
          <div className="footer-name">JellyWave<span className="rdot" /></div>
          <a className="mono dim" href={GITHUB}>github.com/{REPO}</a>
        </div>
      </div>
      <p className="dim small-text">
        Free and open source. Not affiliated with Jellyfin, Spotify, Apple or Nothing; their names belong to their owners.
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <div className="bg" aria-hidden="true">
        <div className="ambient" style={{ backgroundImage: `url(${media('ambient.jpg')})` }} />
        <div className="grid" />
      </div>
      <Nav />
      <main>
        <Hero />
        <What />
        <How />
        <Looks />
        <Pocket />
        <Features />
        <Faq />
        <Download />
      </main>
      <Footer />
    </>
  );
}

// ---------- icons (thin outline, like the Nothing style) ----------
const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
function IconFiles() {
  return (
    <svg {...svgProps} className="flow-icon">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M10 16.5V11l5-1v5" /><circle cx="9" cy="16.5" r="1.2" /><circle cx="14" cy="15" r="1.2" />
    </svg>
  );
}
function IconServer() {
  return (
    <svg {...svgProps} className="flow-icon">
      <rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h.01M8 17h.01M12 7h5M12 17h5" />
    </svg>
  );
}
function IconDown() {
  return (
    <svg {...svgProps} width="18" height="18" strokeWidth="1.8">
      <path d="M12 4v12m0 0-5-5m5 5 5-5M5 20h14" />
    </svg>
  );
}
