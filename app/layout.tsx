import type { Metadata } from "next";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tyled.Live",
  description: "Websites for Masonic lodges.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    // suppressHydrationWarning: the init script below may add `dark` to <html>
    // before React hydrates, when the visitor is following their OS preference.
    <html lang="en" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">{children}</body>
    </html>
  );
}
