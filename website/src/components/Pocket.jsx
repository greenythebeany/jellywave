import { useState } from 'react';
import Shot from './Shot.jsx';

const POINTS = [
  ['Synced lyrics', 'Lines light up with the song, from lrclib.net, your own server or lyrics.ovh.'],
  ['Offline downloads', 'Save albums and playlists to your phone and listen without a connection.'],
  ['Lock-screen controls', 'Play, pause and skip from the lock screen. Music keeps playing in the background.'],
  ['A real queue', 'Songs you add play in order, before the rest of the album. Drag to reorder, swipe to remove.']
];

// The phone is the one thing to play with: open and close the lyrics sheet.
export default function Pocket() {
  const [lyrics, setLyrics] = useState(false);
  return (
    <section className="pocket" id="phone" aria-labelledby="pocket-title">
      <div className="pocket-phone">
        <div className="phone big">
          <Shot name="p-nothing" width="585" height="1266" alt="The full-screen player on a phone, in the Nothing look" />
          <div className={`sheet${lyrics ? ' up' : ''}`} aria-hidden={!lyrics}>
            <Shot name="p-nothing-lyrics" width="585" height="1266" alt="The lyrics sheet, with the current line lit" />
          </div>
        </div>
        <button type="button" className="btn btn-ink" aria-pressed={lyrics} onClick={() => setLyrics((v) => !v)}>
          {lyrics ? 'Back to the player' : 'Open the lyrics'}
        </button>
      </div>
      <div className="pocket-text">
        <h2 id="pocket-title">Made for listening.</h2>
        <dl className="points">
          {POINTS.map(([title, text]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
