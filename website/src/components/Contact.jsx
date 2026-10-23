import { ISSUES } from '../site.js';

// GitHub Issues is the only contact channel (see the Privacy Policy), so the
// form is a plain GET to GitHub's new-issue page: the visitor reviews and
// posts it there, nothing goes through this site, and it works without script.
export default function Contact() {
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="contact-text">
        <h2 id="contact-title">Found a bug? Missing something?</h2>
        <p className="lead">Write it here and it opens as a new issue on GitHub, where you can check it and post it. You need a free GitHub account.</p>
      </div>
      <form className="contact-form" action={`${ISSUES}/new`} method="get" target="_blank">
        <fieldset className="kind">
          <legend>It's about</legend>
          <label><input type="radio" name="labels" value="bug" defaultChecked />A bug</label>
          <label><input type="radio" name="labels" value="enhancement" />An idea</label>
          <label><input type="radio" name="labels" value="question" />A question</label>
        </fieldset>
        <label className="field">
          <span>Title</span>
          <input name="title" required maxLength={120} autoComplete="off" placeholder="Lyrics don't scroll on Android" />
        </label>
        <label className="field">
          <span>Details</span>
          <textarea name="body" rows={6} placeholder="What happened, what you expected, your device and Triptych version." />
        </label>
        <button className="btn btn-ink" type="submit">Continue on GitHub</button>
      </form>
    </section>
  );
}
