import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Tyled<span className="text-indigo-600">.</span>Live
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/pricing" className="hover:text-indigo-600">
              Pricing
            </Link>
            {user?.platformRole === "PLATFORM_ADMIN" ? (
              <Link href="/admin" className="hover:text-indigo-600">
                Admin
              </Link>
            ) : (
              <Link href="/login" className="hover:text-indigo-600">
                Sign in
              </Link>
            )}
            <Link href="/signup" className="btn-primary whitespace-nowrap">
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Create your lodge site</span>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
        © {new Date().getFullYear()} Tyled.Live · Websites for Masonic lodges
      </footer>
    </div>
  );
}
