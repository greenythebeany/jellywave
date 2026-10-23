import { useEffect, useState } from 'react';
import Mark from './Mark.jsx';
import { motionOff, setMotion } from '../site.js';

// Hidden on the first screen (the hero has its own title); slides in once the
// page is scrolled. Keyboard focus shows it at any position. The switch turns
// every animation on the page off (or back on), remembered in this browser.
export default function Nav() {
  const [shown, setShown] = useState(false);
  const [motion, setMotionState] = useState(true);
  useEffect(() => setMotionState(!motionOff()), []);
  const toggleMotion = () => { setMotion(!motion); setMotionState(!motion); };
  useEffect(() => {
    const update = () => setShown(scrollY > 80);
    update();
    addEventListener('scroll', update, { passive: true });
    return () => removeEventListener('scroll', update);
  }, []);
  return (
    <header className="nav" data-shown={shown}>
      <a className="brand" href="#top" aria-label="Triptych, back to the top"><Mark className="brand-mark" />Triptych</a>
      <nav className="nav-links" aria-label="Sections">
        <a href="#how">How it works</a>
        <a href="#faq">FAQ</a>
        <a href="#download" aria-label="Download">
          <span className="nav-word">Download</span>
          <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-5-5m5 5 5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </nav>
      <button className="motion" type="button" aria-pressed={motion} onClick={toggleMotion}>
        <span className="motion-switch" aria-hidden="true" /><span className="motion-label">Animations</span>
      </button>
    </header>
  );
}
