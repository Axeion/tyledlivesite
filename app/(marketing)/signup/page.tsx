import { SignupWizard } from "@/components/SignupWizard";
import { env } from "@/lib/env";
import { TEMPLATES } from "@/templates/registry";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const templates = TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, tier: t.tier, swatch: t.swatch }));
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Create your lodge website</h1>
      <p className="mt-2 text-neutral-600">
        Five quick steps. Your site stays private until the platform team verifies your lodge.
      </p>
      <SignupWizard templates={templates} platformDomain={env.platformDomain} />
    </main>
  );
}
