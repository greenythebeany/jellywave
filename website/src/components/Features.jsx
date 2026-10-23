import { FEATURES } from '../content.js';

export default function Features() {
  return (
    <section className="features" id="features" aria-labelledby="features-title">
      <h2 id="features-title">Everything else you'd expect.</h2>
      <dl className="feature-list">
        {FEATURES.map(([title, text]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
