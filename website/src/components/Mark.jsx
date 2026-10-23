// Triptych mark on the 411 x 453 grid of brand/triptych-*.svg: the first two
// bars take the text colour, the third is always the red accent.
export default function Mark({ className = 'mark' }) {
  return (
    <svg className={className} viewBox="0 0 411 453" aria-hidden="true">
      <rect className="bar bar-1" y="103" width="113" height="350" rx="24" fill="currentColor" />
      <rect className="bar bar-2" x="149" width="113" height="453" rx="24" fill="currentColor" />
      <rect className="bar bar-3" x="298" y="103" width="113" height="350" rx="24" fill="var(--accent)" />
    </svg>
  );
}
