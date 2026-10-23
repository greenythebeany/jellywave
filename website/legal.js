// Turns the legal documents in ../docs/legal into the website's /terms/ and
// /privacy/ pages at build time, so the site always shows the same text as the
// repository. The documents only use a small part of Markdown (headings,
// paragraphs, "- " lists, **bold**, _italic_, `code` and links), and that is
// all this handles.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOCS = resolve(__dirname, '../docs/legal');
const BLOB = 'https://github.com/greenythebeany/triptych/blob/main/docs/legal';
// Documents that have their own page on the site; the rest link to GitHub.
const PAGES = { 'TERMS.md': '../terms/', 'PRIVACY.md': '../privacy/' };

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const url = PAGES[href] || (/^[A-Z_]+\.md$/.test(href) ? `${BLOB}/${href}` : href);
      const external = /^https?:/.test(url);
      return `<a href="${url}"${external ? ' rel="noopener"' : ''}>${label}</a>`;
    });
}

export function markdownToHtml(md) {
  const out = [];
  let list = null;
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    } else if (line.startsWith('- ')) {
      if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
      (list ||= []).push(line.slice(2));
    } else if (list) list[list.length - 1] += ` ${line}`;
    else para.push(line);
  }
  flush();
  return out.join('\n');
}

export function legalDoc(name) {
  return markdownToHtml(readFileSync(resolve(DOCS, name), 'utf8'));
}

// Vite plugin: replaces <!-- legal:FILE.md --> in a page with that document.
export function legalPages() {
  return {
    name: 'legal-pages',
    transformIndexHtml(html) {
      return html.replace(/<!--\s*legal:([A-Z_]+\.md)\s*-->/g, (_, file) => legalDoc(file));
    },
    configureServer(server) {
      server.watcher.add(DOCS);
      server.watcher.on('change', (file) => { if (file.startsWith(DOCS)) server.ws.send({ type: 'full-reload' }); });
    }
  };
}
