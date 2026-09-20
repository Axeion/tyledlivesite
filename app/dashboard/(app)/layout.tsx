import Link from "next/link";
import { logoutFromDashboard } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireDashboard } from "@/lib/dashboard";
import { lodgeSubdomainUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; admin?: boolean }[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/content", label: "Lodge info" },
  { href: "/dashboard/officers", label: "Officers" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/pages", label: "Pages" },
  { href: "/dashboard/gallery", label: "Gallery" },
  { href: "/dashboard/preview", label: "Preview" },
  { href: "/dashboard/template", label: "Template", admin: true },
  { href: "/dashboard/domain", label: "Custom domain", admin: true },
  { href: "/dashboard/billing", label: "Billing", admin: true },
  { href: "/dashboard/members", label: "Members", admin: true },
  { href: "/dashboard/account", label: "Account" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { lodge, user, membership } = await requireDashboard("EDITOR", { redirect: true });
  const isAdmin = membership.role === "ADMIN";
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500">Dashboard</p>
            <h1 className="font-semibold">
              {lodge.name} No. {lodge.number}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a className="text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug)} target="_blank" rel="noreferrer">
              View site
            </a>
            <span className="text-neutral-500" data-testid="current-user">
              {user.email} · {membership.role.toLowerCase()}
            </span>
            <form action={logoutFromDashboard}>
              <button className="btn-secondary" type="submit">
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[12rem_1fr]">
        <nav aria-label="Dashboard">
          <ul className="space-y-1 text-sm">
            {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded px-3 py-1.5 hover:bg-white hover:shadow-sm dark:hover:bg-neutral-800">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
