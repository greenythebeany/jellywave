// Simple JSON-file based i18n. Locale files live in src/locales/<code>.json
// and mirror the key structure of en_US.json (the reference/fallback locale).
// Missing keys in any other locale silently fall back to English.

export const LOCALES = {
  en_US: 'English',
  fr_FR: 'Français',
  de_DE: 'Deutsch',
  sk_SK: 'Slovenčina',
  cs_CZ: 'Čeština',
  es_ES: 'Español',
  pl_PL: 'Polski',
  ru_RU: 'Русский',
  uk_UA: 'Українська',
  nb_NO: 'Norsk',
  sv_SE: 'Svenska',
  fi_FI: 'Suomi',
  da_DK: 'Dansk',
  nl_NL: 'Nederlands',
  it_IT: 'Italiano'
};

let fallback = {};
let strings = {};
let currentLocale = 'en_US';

async function fetchLocale(code) {
  // fetch() resolves relative URLs against the document's base, not this
  // module's location — build an explicit module-relative URL instead so
  // this works regardless of where the loading page lives.
  const url = new URL(`../locales/${code}.json`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Missing locale file: ${code}`);
  return res.json();
}

export async function loadLocale(code) {
  if (!fallback.nav) {
    try {
      fallback = await fetchLocale('en_US');
    } catch (err) {
      fallback = {};
    }
  }
  if (code === 'en_US') {
    strings = fallback;
  } else {
    try {
      strings = await fetchLocale(code);
    } catch (err) {
      strings = fallback;
      code = 'en_US';
    }
  }
  currentLocale = code;
}

export function getLocale() {
  return currentLocale;
}

// t('nav.home') walks dotted key paths, e.g. { nav: { home: '...' } }
export function t(key, vars) {
  let value = lookup(strings, key);
  if (value === undefined) value = lookup(fallback, key);
  if (value === undefined) return key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
  }
  return value;
}

function lookup(obj, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), obj);
}

// Applies translations to every element carrying a data-i18n* attribute:
//   data-i18n="key"             -> textContent
//   data-i18n-placeholder="key" -> placeholder attribute
//   data-i18n-title="key"       -> title attribute
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}
