/**
 * "system" follows the OS preference rather than naming a palette. Every option
 * declares its brightness so the dark list below can be derived, and a new
 * palette that forgets to is a type error.
 */
type ThemeOption = {
  id: string;
  label: string;
  resolvesTo: "light" | "dark" | "system";
};

export const THEME_OPTIONS = [
  { id: "light", label: "settings.themeLight", resolvesTo: "light" },
  { id: "dark", label: "settings.themeDark", resolvesTo: "dark" },
  { id: "mist", label: "settings.themeMist", resolvesTo: "light" },
  { id: "rose", label: "settings.themeRose", resolvesTo: "light" },
  { id: "pine", label: "settings.themePine", resolvesTo: "dark" },
  { id: "auto", label: "settings.themeSystem", resolvesTo: "system" },
] as const satisfies readonly ThemeOption[];

export type ThemePreference = (typeof THEME_OPTIONS)[number]["id"];
export type ResolvedTheme = Exclude<ThemePreference, "auto">;

// Derived, so isDarkTheme() and the first-paint script cannot drift from the list.
const DARK_THEME_IDS: readonly ResolvedTheme[] = THEME_OPTIONS.filter((option) => option.resolvesTo === "dark").map((option) => option.id);

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function isDarkTheme(theme: ResolvedTheme): boolean {
  return DARK_THEME_IDS.includes(theme);
}

// Apply the saved palette before first paint, including when storage is blocked.
export const THEME_INIT_SCRIPT = `(function(){var t="auto";try{var s=localStorage.getItem("pi-theme");if(${JSON.stringify(THEME_OPTIONS.map((option) => option.id))}.includes(s))t=s}catch(e){}if(t==="auto")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",${JSON.stringify(DARK_THEME_IDS)}.includes(t))})();`;
