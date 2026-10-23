import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import What from './components/What.jsx';
import How from './components/How.jsx';
import Film from './components/Film.jsx';
import Pocket from './components/Pocket.jsx';
import Features from './components/Features.jsx';
import Faq from './components/Faq.jsx';
import Contact from './components/Contact.jsx';
import Download from './components/Download.jsx';
import Footer from './components/Footer.jsx';
import { useEffect } from 'react';
import { FAQ } from './content.js';
import { smoothAnchors } from './site.js';

// FAQPage structured data, from the same questions the page shows.
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
};

export default function App() {
  useEffect(smoothAnchors, []);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <What />
        <How />
        <Film />
        <Pocket />
        <Features />
        <Faq />
        <Contact />
        <Download />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </>
  );
}
