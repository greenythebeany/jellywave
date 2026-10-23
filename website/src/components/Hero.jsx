import { useCallback, useEffect, useRef, useState } from 'react';
import Mark from './Mark.jsx';
import Shot from './Shot.jsx';
import { LOOKS } from '../content.js';
import { reducedMotion } from '../site.js';

const BOOT_KEY = 'triptych-booted';
const BOOT_MS = 2700; // ~1.2 s of level meter, then the settled logo holds for ~1.5 s
const SLIDE_MS = 5200;

// The boot, the same way as on greenybeany.dev/me: the inline script in
// index.html decides before the first paint (once per tab, never with reduced
// motion, ?boot forces it) and puts `booting` on <html>; the CSS then shows the
// meter. Here the page is kept out of reach until it lifts, any click or key
// skips it, and onDone starts the slideshow.
function useBoot(onDone) {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('booting')) { onDone(); return undefined; }
    const page = [...document.body.children].filter((el) => el.tagName !== 'SCRIPT');
    page.forEach((el) => { el.inert = true; });
    let timer;
    const release = () => {
      clearTimeout(timer);
      removeEventListener('pointerdown', finish);
      removeEventListener('keydown', finish);
      page.forEach((el) => { el.inert = false; });
    };
    function finish() {
      release();
      try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* storage blocked */ }
      root.classList.remove('booting');
      onDone();
    }
    // the meter started with the first paint, not with this script
    timer = setTimeout(finish, Math.max(0, BOOT_MS - performance.now()));
    addEventListener('pointerdown', finish);
    addEventListener('keydown', finish);
    return release;
  }, [onDone]);
}

// The three looks fill the screen and lock into place, with an overshoot,
// under the still title. Tabs (arrow keys), swipe or drag, and an autoplay
// that pauses on hover and stops for good once the visitor takes over.
export default function Hero() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState(false);
  const track = useRef(null);
  const tabs = useRef([]);
  const drag = useRef(null);

  useBoot(useCallback(() => { if (!reducedMotion()) setPlaying(true); }, []));

  useEffect(() => {
    if (!playing || hover) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % LOOKS.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [playing, hover]);

  const go = (i, focus = false) => {
    const next = (i + LOOKS.length) % LOOKS.length;
    setIndex(next);
    setPlaying(false);
    if (focus) tabs.current[next]?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') go(index + 1, true);
    if (e.key === 'ArrowLeft') go(index - 1, true);
  };

  // Swipe / drag: follow the finger, then snap to the nearest slide.
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, dx: 0 };
    track.current.classList.add('dragging');
    track.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    drag.current.dx = e.clientX - drag.current.x;
    track.current.style.setProperty('--drag', `${drag.current.dx}px`);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dx } = drag.current;
    drag.current = null;
    track.current.classList.remove('dragging');
    track.current.style.setProperty('--drag', '0px');
    if (Math.abs(dx) > Math.min(120, innerWidth * 0.15)) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      className="hero"
      id="top"
      aria-roledescription="carousel"
      aria-label="The three looks of Triptych"
      data-look={LOOKS[index].key}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div
        className="track"
        ref={track}
        style={{ '--i': index }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {LOOKS.map((look, i) => (
          <div
            className="slide"
            key={look.key}
            id={`look-${look.key}`}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${LOOKS.length}: ${look.label}`}
            inert={i !== index}
          >
            <Shot className="shot" name={`d-${look.key}`} phone={`p-${look.key}`} width="1600" height="900" alt={look.alt} eager={i === 0} />
            <p className="caption"><strong>{look.label}.</strong> {look.caption}</p>
          </div>
        ))}
      </div>

      <div className="boot" aria-hidden="true"><Mark className="boot-mark" /></div>

      <div className="hud">
        <h1 className="title">Triptych<span className="stop" aria-hidden="true" /></h1>
        <div className="intro">
          <p className="lede">A music player for your own Jellyfin server. One library, three looks. Free on Windows, Linux, Android and iPhone.</p>
          <a className="btn" href="#download">Download Triptych</a>
        </div>
        <div className="controls">
          <div className="tabs" role="tablist" aria-label="Choose a look">
            {LOOKS.map((look, i) => (
              <button
                key={look.key}
                ref={(el) => { tabs.current[i] = el; }}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-controls={`look-${look.key}`}
                tabIndex={i === index ? 0 : -1}
                onClick={() => go(i)}
                onKeyDown={onKeyDown}
              >
                {look.label}
              </button>
            ))}
          </div>
          <button
            className="play"
            type="button"
            aria-label={playing ? 'Pause the slideshow' : 'Play the slideshow'}
            data-playing={playing}
            onClick={() => setPlaying((p) => !p)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
