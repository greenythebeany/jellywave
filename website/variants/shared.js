// Shared by the four design directions: the logo, the latest-release links
// (same rules as useLatestRelease in src/App.jsx) and the theme override
// (?theme=light|dark, for screenshots; otherwise the system setting wins).

const REPO = 'greenythebeany/triptych';
export const RELEASES = `https://github.com/${REPO}/releases/latest`;

const params = new URLSearchParams(location.search);
const forced = params.get('theme');
if (forced === 'light' || forced === 'dark') document.documentElement.dataset.theme = forced;

// Three bars on the 411 x 453 grid of brand/triptych-*.svg; the first two
// take the text colour, the third is always the red accent.
export function mark(className = 'mark', title) {
  const label = title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="0 0 411 453" ${label}>
    <rect class="bar bar-1" y="103" width="113" height="350" rx="24" fill="currentColor"/>
    <rect class="bar bar-2" x="149" width="113" height="453" rx="24" fill="currentColor"/>
    <rect class="bar bar-3" x="298" y="103" width="113" height="350" rx="24" fill="var(--accent)"/>
  </svg>`;
}

document.querySelectorAll('[data-mark]').forEach((el) => {
  el.outerHTML = mark(el.className || 'mark', el.dataset.mark || undefined);
});

const TESTS = {
  windows: (n) => /setup.*\.exe$/i.test(n),
  android: (n) => /\.apk$/i.test(n),
  appimage: (n) => /\.appimage$/i.test(n),
  snap: (n) => /\.snap$/i.test(n),
  ipa: (n) => /\.ipa$/i.test(n)
};

// Every [data-asset] link starts on the releases page and is swapped for
// the direct file once the GitHub API answers; [data-version] shows the tag.
fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
  .then((r) => (r.ok ? r.json() : null))
  .then((release) => {
    if (!release) return;
    document.querySelectorAll('[data-version]').forEach((el) => { el.textContent = release.tag_name; });
    document.querySelectorAll('[data-asset]').forEach((a) => {
      const test = TESTS[a.dataset.asset];
      const file = test && release.assets?.find((x) => test(x.name));
      if (file) a.href = file.browser_download_url;
    });
  })
  .catch(() => {});

document.querySelectorAll('[data-asset]').forEach((a) => { if (!a.getAttribute('href')) a.href = RELEASES; });
