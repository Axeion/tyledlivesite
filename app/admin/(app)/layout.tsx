import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin({ redirectTo: "/admin/login" });
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
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
          <form action={logout} className="flex items-center gap-3 text-sm">
            <Link href="/admin/account" className="text-neutral-500 hover:text-indigo-600">
              {admin.email}
            </Link>
            <button className="btn-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
