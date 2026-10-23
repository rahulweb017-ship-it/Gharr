import { Info } from "lucide-react";
import type { EstimateMode, EstimateScope, QualityTier } from "@prisma/client";
import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError } from "@/server/http/errors";
import {
  listPriceCities,
  listPrices,
  listRuleSets,
  listRules,
} from "@/server/services/admin/estimate-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ActionButton } from "@/components/admin/ActionButton";
import { NeedsAdmin } from "@/components/admin/catalogue/NeedsAdmin";
import { SelectorBar } from "@/components/admin/estimate/SelectorBar";
import { RulesTable } from "@/components/admin/estimate/RulesTable";
import { PricesTable } from "@/components/admin/estimate/PricesTable";
import { TabLinks } from "@/components/ui/Segmented";
import { SCOPE_LABELS, TIER_LABELS } from "@/shared/estimate";

export const metadata = { title: "Estimate pricing" };

type Search = { tab?: string; mode?: string; scope?: string; tier?: string; city?: string };

const MODE_LABELS: Record<EstimateMode, string> = { NEW_BUILD: "New build", RENOVATION: "Renovation" };
const TIERS: QualityTier[] = ["BASIC", "STANDARD", "PREMIUM"];
const tierOptions = TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] }));

/** Rule and price tables that drive every new estimate. ADMIN only. */
export default async function EstimatePricingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const actor = await getPageActor();
  const tab = params.tab === "prices" ? "prices" : "rules";

  let body: React.ReactNode;
  let actions: React.ReactNode = null;
  try {
    if (tab === "rules") {
      body = await rulesTab(actor, params);
    } else {
      const prices = await pricesTab(actor, params);
      body = prices.body;
      actions = prices.actions;
    }
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Estimate pricing" />;
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title="Estimate pricing"
        description="Quantity rules and unit prices behind the Estimate Engine."
        actions={actions}
      />
      <p className="mb-4 flex items-start gap-2 rounded-(--radius-card) border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Changes affect new estimates only — saved estimates are snapshots.
      </p>
      <TabLinks
        className="mb-4"
        tabs={[
          { href: "/admin/estimate-pricing", label: "Rules", active: tab === "rules" },
          { href: "/admin/estimate-pricing?tab=prices", label: "Prices", active: tab === "prices" },
        ]}
      />
      {body}
    </>
  );
}

type PageActor = Awaited<ReturnType<typeof getPageActor>>;

async function rulesTab(actor: PageActor, params: Search) {
  const sets = await listRuleSets(actor);
  if (sets.length === 0) return <Empty>No estimate rules exist yet.</Empty>;

  // Pick the requested set; if the scope no longer fits the mode (the admin
  // just switched mode), fall back to that mode's first set.
  const tier = (TIERS as string[]).includes(params.tier ?? "") ? (params.tier as QualityTier) : "STANDARD";
  const exact = sets.find((s) => s.mode === params.mode && s.scope === params.scope && s.tier === tier);
  const chosen = exact ?? sets.find((s) => s.mode === params.mode && s.tier === tier) ?? sets.find((s) => s.tier === tier) ?? sets[0];

  const modes = [...new Set(sets.map((s) => s.mode))];
  const scopes = [...new Set(sets.filter((s) => s.mode === chosen.mode).map((s) => s.scope))];
  const rules = await listRules(actor, { mode: chosen.mode, scope: chosen.scope as EstimateScope, tier: chosen.tier });

  return (
    <>
      <SelectorBar
        action="/admin/estimate-pricing"
        selects={[
          { name: "mode", label: "Mode", value: chosen.mode, options: modes.map((m) => ({ value: m, label: MODE_LABELS[m] })) },
          { name: "scope", label: "Scope", value: chosen.scope, options: scopes.map((s) => ({ value: s, label: SCOPE_LABELS[s] })) },
          { name: "tier", label: "Tier", value: chosen.tier, options: tierOptions },
        ]}
      />
      <p className="mb-3 text-xs text-ink-500">
        Quantity = basis × quantity per basis, plus wastage. For “% of subtotal” lines the quantity per basis is the percentage.
      </p>
      {rules.length ? <RulesTable rules={rules} /> : <Empty>No rules for this combination.</Empty>}
    </>
  );
}

async function pricesTab(actor: PageActor, params: Search) {
  const cities = await listPriceCities(actor);
  if (cities.length === 0) return { body: <Empty>No estimate price tables exist yet.</Empty>, actions: null };

  const city = cities.includes(params.city ?? "") ? params.city! : cities[0];
  const tier = (TIERS as string[]).includes(params.tier ?? "") ? (params.tier as QualityTier) : "STANDARD";
  const prices = await listPrices(actor, { city, tier });
  const drifted = prices.filter((p) => p.driftPercent != null && p.driftPercent !== 0).length;
  const linked = prices.filter((p) => p.productId).length;

  return {
    actions: (
      <ActionButton
        label="Sync material prices from shop"
        path="/admin/estimate-pricing/sync"
        body={{ city, tier }}
        variant="primary"
        confirm={{
          title: `Sync ${TIER_LABELS[tier]} prices in ${city}?`,
          message: `Each of the ${linked} product-linked prices is recomputed as the cheapest active, in-stock offer ÷ pack coverage (${drifted} currently differ). Items with no live offer keep their price. Manual prices such as labour are not touched. Saved estimates are unaffected.`,
          confirmLabel: "Sync prices",
        }}
      />
    ),
    body: (
      <>
        <SelectorBar
          action="/admin/estimate-pricing"
          hidden={{ tab: "prices" }}
          selects={[
            { name: "city", label: "City", value: city, options: cities.map((c) => ({ value: c, label: c })) },
            { name: "tier", label: "Tier", value: tier, options: tierOptions },
          ]}
        />
        <p className="mb-3 text-xs text-ink-500">
          Unit prices are per rule unit, tax-exclusive. “Live derived” is the cheapest active, in-stock offer ÷ pack coverage;
          a badge shows how far the stored price has drifted from it.
        </p>
        {prices.length ? <PricesTable prices={prices} /> : <Empty>No prices for this city and tier.</Empty>}
      </>
    ),
  };
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-sm text-ink-500">
      {children}
    </div>
  );
}
