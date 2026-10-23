import { FAQ } from '../content.js';
import { BASE } from '../site.js';

export default function Faq() {
  return (
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Good to know.</h2>
      <div className="faq-list">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>
              {a}
              {q.startsWith('What happens') && <> <a href={`${BASE}privacy/`}>Read the Privacy Policy</a>.</>}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
