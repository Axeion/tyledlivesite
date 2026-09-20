/**
 * Light/dark preference.
 *
 * The cookie holds an explicit choice only; with no cookie the site follows the
 * operating system. It is read on the server so the correct theme is in the
 * first HTML response (no flash), and written from the client so the toggle is
 * instant. Like the session cookie it is host-scoped, so a lodge subdomain and
 * the apex each remember their own setting.
 *
 * This module is imported by the client toggle, so it must stay free of
 * server-only APIs; the root layout does the cookie read.
 */
export const THEME_COOKIE = "tyled_theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/**
 * Runs before first paint. The server already applied an explicit choice, so
 * this only has to cover "no cookie yet, operating system prefers dark".
 */
export const THEME_INIT_SCRIPT = `try{if(!/(?:^|;\\s*)${THEME_COOKIE}=(?:light|dark)/.test(document.cookie)&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}`;
