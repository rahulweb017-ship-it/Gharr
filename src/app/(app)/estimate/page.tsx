import Link from "next/link";
import {
  Calculator,
  ChevronRight,
  ClipboardList,
  Hammer,
  House,
  LogIn,
  MapPin,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardLink, EmptyState, SectionHeader } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { formatDate } from "@/components/estimate/estimate-format";
import { getPageActor } from "@/server/auth/page-session";
import { listEstimates } from "@/server/services/estimate.service";
import { SCOPE_LABELS, TIER_LABELS } from "@/shared/estimate";

export const metadata = { title: "Get an Estimate" };
export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  { icon: Ruler, title: "Tell us the size", text: "Plot, built-up area, rooms — or just the room you're renovating." },
  { icon: Calculator, title: "Quantity × local price", text: "Every line is a quantity times today's rate in your city. No hidden factors." },
  { icon: ClipboardList, title: "Buy the list", text: "Turn the materials into a cart from verified local suppliers." },
] as const;

/**
 * Estimate home: pick a project type, and (when signed in) revisit saved
 * estimates. Signed-out visitors can still start — the wizard only asks for
 * an account at the point of saving.
 */
export default async function EstimateHomePage() {
  const actor = await getPageActor();
  const estimates = actor ? await listEstimates(actor.userId) : [];

  return (
    <div className="pb-8">
      <PageHeader title="Get an Estimate" subtitle="Transparent, itemised construction costs" />

      <div className="px-4 pt-4 md:px-0 md:pt-0">
        <h2 className="mb-3 text-sm font-semibold text-ink-800">What are you planning?</h2>
        <div className="grid grid-cols-2 gap-3 md:max-w-2xl md:gap-4">
          <TypeCard
            href="/estimate/new?mode=NEW_BUILD"
            icon={<House aria-hidden className="size-9" />}
            title="New Home Construction"
            subtitle="Ground-up build, 1–5 floors"
          />
          <TypeCard
            href="/estimate/new?mode=RENOVATION"
            icon={<Hammer aria-hidden className="size-9" />}
            title="Renovation"
            subtitle="Bathroom, kitchen, flooring, painting"
          />
        </div>
      </div>

      <section aria-labelledby="how-it-works" className="mt-6 px-4 md:px-0">
        <Card className="bg-trust-50/60 p-4 md:p-5">
          <h2 id="how-it-works" className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <ShieldCheck aria-hidden className="size-4 text-trust-600" />
            How it works — nothing hidden
          </h2>
          <ol className="mt-3 grid gap-3 md:grid-cols-3 md:gap-5">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-trust-700 shadow-(--shadow-card)">
                  <Icon aria-hidden className="size-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{title}</span>
                  <span className="block text-xs leading-relaxed text-ink-500">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mt-8">
        <SectionHeader title="My estimates" />
        {!actor ? (
          <Card className="mx-4 md:mx-0">
            <EmptyState
              className="py-10"
              icon={<LogIn aria-hidden className="size-7" />}
              title="Sign in to see your estimates"
              description="You can try the estimator without an account. Sign in to save estimates and turn them into a shopping list."
              action={<ButtonLink href="/login?next=/estimate" variant="secondary">Sign in</ButtonLink>}
            />
          </Card>
        ) : estimates.length === 0 ? (
          <Card className="mx-4 md:mx-0">
            <EmptyState
              className="py-10"
              icon={<Calculator aria-hidden className="size-7" />}
              title="No estimates yet"
              description="Start with a new home or a renovation above — it takes about a minute."
            />
          </Card>
        ) : (
          <ul className="grid gap-3 px-4 md:grid-cols-2 md:px-0 lg:grid-cols-3">
            {estimates.map((e) => (
              <li key={e.id}>
                <CardLink href={`/estimate/${e.id}`} className="flex items-center gap-3 p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    {e.mode === "NEW_BUILD" ? (
                      <House aria-hidden className="size-6" />
                    ) : (
                      <Hammer aria-hidden className="size-6" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink-900">{e.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">
                      {SCOPE_LABELS[e.scope]} · <MapPin aria-hidden className="inline size-3 align-[-1px]" /> {e.city}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Money paise={e.totalPaise} className="text-sm font-bold text-ink-900" />
                      <Chip className="py-0.5">{TIER_LABELS[e.tier]}</Chip>
                      <span className="text-[11px] text-ink-400">{formatDate(e.updatedAt)}</span>
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-300" />
                </CardLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TypeCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-(--radius-card) border-2 border-ink-100 bg-white p-4 text-center shadow-(--shadow-card) transition-colors hover:border-brand-500 hover:bg-brand-50/50 md:p-6"
    >
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-white">
        {icon}
      </span>
      <span className="text-sm font-bold text-ink-900 md:text-base">{title}</span>
      <span className="text-[11px] leading-snug text-ink-500 md:text-xs">{subtitle}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
        Start <ChevronRight aria-hidden className="size-3.5" />
      </span>
    </Link>
  );
}
