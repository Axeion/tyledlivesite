import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin({ redirectTo: "/admin/login" });
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link href="/admin" className="font-bold">
              Tyled.Live Admin
            </Link>
            <Link href="/admin" className="hover:text-indigo-600">
              Approval queue
            </Link>
            <Link href="/admin/lodges" className="hover:text-indigo-600">
              Lodges
            </Link>
            <Link href="/admin/domains" className="hover:text-indigo-600">
              Domains
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin/account" className="text-neutral-500 hover:text-indigo-600">
              {admin.email}
            </Link>
            <form action={logout}>
              <button className="btn-secondary" type="submit">
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
