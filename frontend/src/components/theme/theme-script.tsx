/** Stored preferences win; first-time visitors see the cinematic dark theme before paint. */
export const THEME_STORAGE_KEY = 'af-theme';

export const THEME_INIT_SCRIPT =
  `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `var t=(s==='light'||s==='dark')?s:'dark';` +
  `document.documentElement.setAttribute('data-theme',t)}catch(e){` +
  `document.documentElement.setAttribute('data-theme','dark')}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
