import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tyled.Live",
  description: "Websites for Masonic lodges.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">{children}</body>
    </html>
  );
}
