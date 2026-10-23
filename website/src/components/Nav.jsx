import Mark from './Mark.jsx';

export default function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#top" aria-label="Triptych, back to the top"><Mark className="brand-mark" />Triptych</a>
      <nav className="nav-links" aria-label="Sections">
        <a href="#how">How it works</a>
        <a href="#faq">FAQ</a>
        <a href="#download">Download</a>
      </nav>
    </header>
  );
}
