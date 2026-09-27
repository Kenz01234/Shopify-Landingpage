/**
 * Setzt das Farbschema vor dem ersten Paint (verhindert Aufblitzen).
 * Die Wahl ist eine reine Anzeige-Einstellung pro Browser und liegt deshalb in localStorage.
 */
const script = `(function(){try{var p=localStorage.getItem('qa-theme')||'light';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.themePref=p;}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
