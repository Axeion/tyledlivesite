import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Tyled<span className="text-indigo-600">.</span>Live
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
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
            <Link href="/signup" className="btn-primary">
              Create your lodge site
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} Tyled.Live · Websites for Masonic lodges
      </footer>
    </div>
  );
}
