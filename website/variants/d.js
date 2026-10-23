// D · the boot meter and the looks carousel.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Boot, the same way as on greenybeany.dev/me: added here by the script (a page
// without scripts is never covered), once per tab, never with reduced motion,
// skippable with any click or key, and the page stays locked and out of the tab
// order until it lifts. ?boot forces it again (for checking it).
const BOOT_KEY = 'triptych-booted';
function shouldBoot() {
  if (new URLSearchParams(location.search).has('boot')) return true;
  try { if (sessionStorage.getItem(BOOT_KEY)) return false; } catch (err) { /* storage blocked: just show it */ }
  return !reduce;
}

let onBooted = () => {};
const booted = new Promise((resolve) => { onBooted = resolve; });

if (shouldBoot()) {
  const boot = document.createElement('div');
  boot.className = 'boot';
  boot.setAttribute('aria-hidden', 'true');
  boot.innerHTML = `<svg class="boot-mark" viewBox="0 0 411 453">
      <rect class="bar bar-1" y="103" width="113" height="350" rx="24"/>
      <rect class="bar bar-2" x="149" width="113" height="453" rx="24"/>
      <rect class="bar bar-3" x="298" y="103" width="113" height="350" rx="24"/>
    </svg><p class="boot-skip">Click or press any key to skip</p>`;
  document.body.prepend(boot);
  document.body.classList.add('booting');
  const page = [...document.body.children].filter((el) => el !== boot && el.tagName !== 'SCRIPT');
  page.forEach((el) => el.setAttribute('inert', ''));

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem(BOOT_KEY, '1'); } catch (err) { /* ignore */ }
    page.forEach((el) => el.removeAttribute('inert'));
    document.body.classList.remove('booting');
    boot.classList.add('done');
    boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    removeEventListener('pointerdown', finish);
    removeEventListener('keydown', finish);
    onBooted();
  };
  // ~1.2 s of level meter, then the settled logo holds for ~1.5 s
  setTimeout(finish, 2700);
  addEventListener('pointerdown', finish);
  addEventListener('keydown', finish);
} else {
  onBooted();
}

// Carousel: Nothing, Spotify, Apple Music. Slides lock into place with an
// overshoot. Arrow keys on the tabs, swipe/drag on the slides, and a gentle
// autoplay that stops for good once the visitor takes over (or can be paused).
const hero = document.querySelector('.hero');
const track = hero.querySelector('.track');
const slides = [...track.children];
const tabs = [...hero.querySelectorAll('[role=tab]')];
const play = hero.querySelector('.play');
let index = 0;
let timer = null;

function go(i, { focus = false, user = false } = {}) {
  index = (i + slides.length) % slides.length;
  track.style.setProperty('--i', index);
  hero.dataset.look = slides[index].classList[1].slice(2);
  tabs.forEach((t, k) => {
    t.setAttribute('aria-selected', String(k === index));
    t.tabIndex = k === index ? 0 : -1;
  });
  slides.forEach((s, k) => s.toggleAttribute('inert', k !== index));
  if (focus) tabs[index].focus();
  if (user) stop();
}

function start() {
  if (reduce) return;
  clearInterval(timer);
  timer = setInterval(() => go(index + 1), 5200);
  play.dataset.playing = 'true';
  play.setAttribute('aria-label', 'Pause the slideshow');
}
function stop() {
  clearInterval(timer);
  timer = null;
  play.dataset.playing = 'false';
  play.setAttribute('aria-label', 'Play the slideshow');
}

tabs.forEach((t, k) => {
  t.addEventListener('click', () => go(k, { user: true }));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1, { focus: true, user: true });
    if (e.key === 'ArrowLeft') go(index - 1, { focus: true, user: true });
  });
});
play.addEventListener('click', () => (timer ? stop() : start()));

// Swipe / drag: follow the finger, then snap to the nearest slide.
let startX = null;
let dx = 0;
track.addEventListener('pointerdown', (e) => {
  startX = e.clientX;
  dx = 0;
  track.classList.add('dragging');
  track.setPointerCapture(e.pointerId);
});
track.addEventListener('pointermove', (e) => {
  if (startX === null) return;
  dx = e.clientX - startX;
  track.style.setProperty('--drag', `${dx}px`);
});
const release = () => {
  if (startX === null) return;
  track.classList.remove('dragging');
  track.style.setProperty('--drag', '0px');
  if (Math.abs(dx) > Math.min(120, innerWidth * 0.15)) go(index + (dx < 0 ? 1 : -1), { user: true });
  startX = null;
};
track.addEventListener('pointerup', release);
track.addEventListener('pointercancel', release);

// Don't advance while someone is reading or pointing at it.
hero.addEventListener('pointerenter', () => { if (timer) clearInterval(timer); });
hero.addEventListener('pointerleave', () => { if (play.dataset.playing === 'true') start(); });

go(0);
stop();
// the slideshow starts only once the boot has lifted
booted.then(() => { if (!reduce) start(); });
