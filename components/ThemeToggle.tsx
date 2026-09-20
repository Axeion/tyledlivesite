"use client";

import { THEME_COOKIE, THEME_MAX_AGE } from "@/lib/theme";

/**
 * Sun/moon switch. Which icon shows is decided by CSS from the `dark` class on
 * <html>, not by React state, so it is correct in the very first paint — before
 * hydration, and whether the theme came from the cookie or the operating
 * system. Clicking flips the class immediately and stores the choice so the
 * server renders the same thing next time.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    document.cookie = `${THEME_COOKIE}=${dark ? "dark" : "light"}; path=/; max-age=${THEME_MAX_AGE}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      data-testid="theme-toggle"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-current/20 text-current opacity-80 transition hover:opacity-100 ${className}`}
    >
      {/* Light mode: offer the moon. Dark mode: offer the sun. */}
      <svg className="h-4 w-4 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg className="hidden h-4 w-4 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
      </svg>
    </button>
  );
}
