import { useLatestRelease } from '../site.js';

// The whole band is the Windows link; the other systems sit under it.
export default function Download() {
  const r = useLatestRelease();
  return (
    <section className="download" id="download" aria-labelledby="download-title">
      <a className="band" href={r.windows}>
        <span className="band-note">Starts the download for Windows. Other systems are below.</span>
        <svg className="band-arrow" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 34 34 14M18 14h16v16" fill="none" stroke="currentColor" strokeWidth="4" /></svg>
        <h2 id="download-title" className="band-word">Download</h2>
      </a>
      <ul className="others">
        <li><a href={r.android}>Android, APK</a></li>
        <li><a href={r.appimage}>Linux, AppImage</a></li>
        <li><a href={r.snap}>Linux, snap</a></li>
        <li><a href={r.ipa}>iPhone, unsigned .ipa</a></li>
      </ul>
      <p className="fine">
        {r.version ? `Latest ${r.version}. ` : 'Latest release. '}
        Windows updates itself from inside the app; on iPhone, sideload with AltStore or Sideloadly.
        After installing, open Triptych, enter your Jellyfin server address and sign in.
      </p>
    </section>
  );
}
