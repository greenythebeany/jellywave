import { media } from '../site.js';

// The 2.3.0 walkthrough. It never plays by itself; the native controls pause it.
export default function Film() {
  return (
    <section className="film" aria-labelledby="film-title">
      <div className="split">
        <h2 id="film-title">Twenty seconds of Triptych.</h2>
        <p className="lead">Signing in, an artist page, synced lyrics and a switch between all three looks, recorded in the app. No sound.</p>
      </div>
      <video
        className="film-video"
        src={media('v23/triptych-2.3.0.mp4')}
        poster={media('v23/poster-2.3.0.jpg')}
        width="1920"
        height="1080"
        controls
        muted
        playsInline
        preload="none"
        aria-label="A 20-second walkthrough of Triptych"
      />
    </section>
  );
}
