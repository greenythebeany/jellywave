import { useEffect, useState } from 'react';
import Mark from './Mark.jsx';

// Hidden on the first screen (the hero has its own title); slides in once the
// page is scrolled. Keyboard focus shows it at any position.
export default function Nav() {
  const [shown, setShown] = useState(false);
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
        <a href="#download">Download</a>
      </nav>
    </header>
  );
}
