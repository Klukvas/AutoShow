/**
 * Theme bootstrap: runs synchronously in <head> BEFORE first paint so the
 * stored (or system) theme applies without a flash of the wrong theme.
 * Order of precedence: localStorage('af-theme') → prefers-color-scheme → light.
 */
export const THEME_STORAGE_KEY = 'af-theme';

export const THEME_INIT_SCRIPT =
  `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');` +
  `document.documentElement.setAttribute('data-theme',t)}catch(e){` +
  `document.documentElement.setAttribute('data-theme','light')}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
