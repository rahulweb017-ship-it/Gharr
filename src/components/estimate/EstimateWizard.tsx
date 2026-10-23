"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bath,
  Check,
  CookingPot,
  Grid3x3,
  Hammer,
  House,
  Info,
  PaintRoller,
  Pencil,
} from "lucide-react";
import type { ZodIssue } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, StickyBar } from "@/components/ui/Surface";
import { Field, SelectInput, TextInput, fieldErrors } from "@/components/ui/Field";
import { MoneyRow, Money } from "@/components/ui/Money";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { Segmented } from "@/components/ui/Segmented";
import { apiPost, apiPut } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  NewBuildInput,
  RenovationInput,
  type EstimateInput,
} from "@/shared/contracts/estimate";
import {
  ESTIMATE_DISCLAIMER,
  SCOPE_LABELS,
  TIER_LABELS,
  type EstimateMode,
  type QualityTier,
} from "@/shared/estimate";
import {
  RENOVATION_SCOPES,
  TIER_HINTS,
  inputsSummary,
  type RenovationScope,
} from "./estimate-format";

/**
 * The four-step estimate wizard (Basic Info → Details → Preferences → Review),
 * used both to create an estimate and to edit one.
 *
 * Client-side checks run the same zod contract the API uses, filtered to the
 * fields of the current step, so a message shown here is word-for-word what the
 * server would say. The server is still the truth: its field errors are mapped
 * back to the step that owns the field.
 *
 * Signed-out visitors can go all the way to a live preview; only saving needs
 * an account, and their draft survives the trip through sign-in.
 */

export const DRAFT_KEY = "gharr.estimateDraft";

const STEPS = ["Basic Info", "Details", "Preferences", "Review"] as const;
const REVIEW = STEPS.length - 1;

/** Every value as the form holds it — numbers stay strings until submit. */
interface Draft {
  mode: EstimateMode;
  title: string;
  city: string;
  tier: QualityTier;
  scope: RenovationScope;
  plotSqft: string;
  builtUpSqft: string;
  floors: string;
  rooms: string;
  bathrooms: string;
  areaSqft: string;
}

const FIELD_STEP: Record<string, number> = {
  mode: 0,
  title: 0,
  city: 0,
  scope: 0,
  plotSqft: 1,
  builtUpSqft: 1,
  floors: 1,
  rooms: 1,
  bathrooms: 1,
  areaSqft: 1,
  tier: 2,
};

const SCOPE_ICONS: Record<RenovationScope, typeof Bath> = {
  BATHROOM: Bath,
  KITCHEN: CookingPot,
  FLOORING: Grid3x3,
  PAINTING: PaintRoller,
};

const TIER_OPTIONS = (Object.keys(TIER_LABELS) as QualityTier[]).map((tier) => ({
  value: tier,
  label: TIER_LABELS[tier],
  hint: TIER_HINTS[tier].short,
}));

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

interface Preview {
  materialsPaise: number;
  labourPaise: number;
  otherPaise: number;
  totalPaise: number;
}

function draftFrom(initial: EstimateInput | undefined, mode: EstimateMode, city: string): Draft {
  const base: Draft = {
    mode,
    title: "",
    city,
    tier: "STANDARD",
    scope: "BATHROOM",
    plotSqft: "",
    builtUpSqft: "",
    floors: "1",
    rooms: "2",
    bathrooms: "2",
    areaSqft: "",
  };
  if (!initial) return base;
  if (initial.mode === "NEW_BUILD") {
    return {
      ...base,
      mode: "NEW_BUILD",
      title: initial.title,
      city: initial.city,
      tier: initial.tier,
      plotSqft: String(initial.plotSqft),
      builtUpSqft: String(initial.builtUpSqft),
      floors: String(initial.floors),
      rooms: String(initial.rooms),
      bathrooms: String(initial.bathrooms),
    };
  }
  return {
    ...base,
    mode: "RENOVATION",
    title: initial.title,
    city: initial.city,
    tier: initial.tier,
    scope: initial.scope,
    areaSqft: String(initial.areaSqft),
  };
}

/** The request body for the draft's mode — only the fields that mode accepts. */
function toPayload(d: Draft) {
  const common = { title: d.title.trim(), city: d.city, tier: d.tier };
  return d.mode === "NEW_BUILD"
    ? {
        mode: "NEW_BUILD" as const,
        ...common,
        plotSqft: Number(d.plotSqft),
        builtUpSqft: Number(d.builtUpSqft),
        floors: Number(d.floors),
        rooms: Number(d.rooms),
        bathrooms: Number(d.bathrooms),
      }
    : {
        mode: "RENOVATION" as const,
        ...common,
        scope: d.scope,
        areaSqft: Number(d.areaSqft),
      };
}

/** Contract errors for fields owned by steps up to and including `upTo`. */
function validateUpTo(d: Draft, upTo: number): Record<string, string> {
  const schema = d.mode === "NEW_BUILD" ? NewBuildInput : RenovationInput;
  // Empty numeric fields would coerce to 0; send them as-is so the range message shows.
  const raw = { ...toPayload(d) } as Record<string, unknown>;
  for (const key of ["plotSqft", "builtUpSqft", "areaSqft"]) {
    if (key in raw && (d[key as keyof Draft] as string).trim() === "") raw[key] = undefined;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return {};

  const out: Record<string, string> = {};
  parsed.error.issues.forEach((issue: ZodIssue) => {
    const field = String(issue.path[0] ?? "");
    const step = FIELD_STEP[field];
    if (step == null || step > upTo || out[field]) return;
    out[field] =
      issue.code === "invalid_type" && issue.received === "undefined"
        ? "This field is required"
        : issue.message;
  });
  return out;
}

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Private mode or storage disabled: the user re-enters after sign-in.
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function EstimateWizard({
  signedIn,
  cities,
  unavailableCities = [],
  defaultCity,
  initialMode = "NEW_BUILD",
  resume = false,
  estimateId,
  initial,
}: {
  signedIn: boolean;
  /** Cities with a price table — the only ones that can be estimated. */
  cities: string[];
  /** Shown disabled, so the list does not look like Gharr only knows one city. */
  unavailableCities?: string[];
  defaultCity: string;
  initialMode?: EstimateMode;
  /** Restore the draft saved before a sign-in detour. */
  resume?: boolean;
  /** Edit mode: PUT to this estimate instead of creating one. */
  estimateId?: string;
  initial?: EstimateInput;
}) {
  const router = useRouter();
  const editing = Boolean(estimateId);

  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial, initialMode, defaultCity));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSeq = useRef(0);

  // Restoring happens after mount: sessionStorage does not exist during SSR.
  useEffect(() => {
    if (!resume || editing) return;
    const saved = readDraft();
    if (saved && typeof saved === "object" && saved.mode) {
      setDraft((current) => ({ ...current, ...saved }));
      setStep(REVIEW);
    }
  }, [resume, editing]);

  const payloadKey = useMemo(() => JSON.stringify(toPayload(draft)), [draft]);

  // Live total on the review step, debounced so rapid edits send one request.
  useEffect(() => {
    if (step !== REVIEW) return;
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    setPreviewError(null);
    const timer = window.setTimeout(async () => {
      const result = await apiPost<Preview>("/estimates/preview", JSON.parse(payloadKey));
      if (seq !== previewSeq.current) return; // a newer request superseded this one
      setPreviewLoading(false);
      if (result.ok) {
        setPreview(result.data);
      } else {
        setPreview(null);
        setPreviewError(result.error.message);
        const fields = fieldErrors(result.error.details);
        if (Object.keys(fields).length) setErrors(fields);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [step, payloadKey]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function goTo(target: number) {
    setFormError(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    if (step === 0 && !cities.includes(draft.city)) return; // the city field already explains why
    const found = validateUpTo(draft, step);
    setErrors(found);
    const firstStep = Math.min(...Object.keys(found).map((f) => FIELD_STEP[f] ?? step));
    if (Object.keys(found).length) {
      if (firstStep < step) goTo(firstStep);
      return;
    }
    goTo(step + 1);
  }

  function sendToLogin() {
    writeDraft(draft);
    router.push(`/login?next=${encodeURIComponent("/estimate/new?resume=1")}`);
  }

  async function submit() {
    const found = validateUpTo(draft, REVIEW);
    if (Object.keys(found).length) {
      setErrors(found);
      goTo(Math.min(...Object.keys(found).map((f) => FIELD_STEP[f] ?? 0)));
      return;
    }

    if (!signedIn && !editing) {
      sendToLogin();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const body = toPayload(draft);
    const result = editing
      ? await apiPut<{ id: string }>(`/estimates/${estimateId}`, body)
      : await apiPost<{ id: string }>("/estimates", body);

    if (result.ok) {
      clearDraft();
      router.push(`/estimate/${result.data.id}`);
      router.refresh();
      return;
    }

    setSubmitting(false);
    if (result.error.code === "UNAUTHENTICATED") {
      if (editing) {
        router.push(`/login?next=${encodeURIComponent(`/estimate/${estimateId}/edit`)}`);
      } else {
        sendToLogin();
      }
      return;
    }

    const fields = fieldErrors(result.error.details);
    const owned = Object.keys(fields).filter((f) => f in FIELD_STEP);
    if (owned.length) {
      setErrors(fields);
      goTo(Math.min(...owned.map((f) => FIELD_STEP[f])));
    }
    setFormError(result.error.message);
  }

  const cityAvailable = cities.includes(draft.city);
  const scopeMeta = RENOVATION_SCOPES.find((s) => s.value === draft.scope)!;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-40 md:px-0 md:pb-0">
      <ProgressSteps steps={STEPS} current={step} className="mb-6" />

      {formError && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {formError}
        </p>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === REVIEW) void submit();
          else next();
        }}
      >
        {step === 0 && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink-800">Project type</legend>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard
                  selected={draft.mode === "NEW_BUILD"}
                  onSelect={() => update("mode", "NEW_BUILD")}
                  icon={<House aria-hidden className="size-8" />}
                  title="New Home Construction"
                  name="mode"
                />
                <ChoiceCard
                  selected={draft.mode === "RENOVATION"}
                  onSelect={() => update("mode", "RENOVATION")}
                  icon={<Hammer aria-hidden className="size-8" />}
                  title="Renovation"
                  subtitle="Bathroom, kitchen, flooring, painting"
                  name="mode"
                />
              </div>
            </fieldset>

            <Field label="Project name" htmlFor="est-title" error={errors.title}>
              <TextInput
                id="est-title"
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="E.g. My Dream Home"
                maxLength={60}
                autoComplete="off"
                invalid={Boolean(errors.title)}
              />
            </Field>

            <Field
              label="City"
              htmlFor="est-city"
              error={errors.city ?? (!cityAvailable ? "Estimates aren't available in this city yet" : null)}
              hint="Prices are local — materials and labour rates for this city."
            >
              <SelectInput
                id="est-city"
                value={draft.city}
                onChange={(e) => update("city", e.target.value)}
                invalid={Boolean(errors.city) || !cityAvailable}
              >
                {!cityAvailable && <option value={draft.city}>{draft.city} (coming soon)</option>}
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {unavailableCities
                  .filter((c) => !cities.includes(c) && c !== draft.city)
                  .map((c) => (
                    <option key={c} value={c} disabled>
                      {c} (coming soon)
                    </option>
                  ))}
              </SelectInput>
            </Field>

            {draft.mode === "RENOVATION" && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-800">What are you renovating?</legend>
                <div className="grid grid-cols-2 gap-3">
                  {RENOVATION_SCOPES.map((s) => {
                    const Icon = SCOPE_ICONS[s.value];
                    return (
                      <ChoiceCard
                        key={s.value}
                        compact
                        name="scope"
                        selected={draft.scope === s.value}
                        onSelect={() => update("scope", s.value)}
                        icon={<Icon aria-hidden className="size-6" />}
                        title={s.label}
                      />
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {step === 1 && draft.mode === "NEW_BUILD" && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Plot size (sq ft)" htmlFor="est-plot" error={errors.plotSqft}>
                <TextInput
                  id="est-plot"
                  inputMode="numeric"
                  value={draft.plotSqft}
                  onChange={(e) => update("plotSqft", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="E.g. 1200"
                  invalid={Boolean(errors.plotSqft)}
                />
              </Field>
              <Field
                label="Built-up area (sq ft)"
                htmlFor="est-builtup"
                error={errors.builtUpSqft}
                hint="Total across all floors"
              >
                <TextInput
                  id="est-builtup"
                  inputMode="numeric"
                  value={draft.builtUpSqft}
                  onChange={(e) => update("builtUpSqft", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="E.g. 1800"
                  invalid={Boolean(errors.builtUpSqft)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Floors" htmlFor="est-floors" error={errors.floors}>
                <SelectInput id="est-floors" value={draft.floors} onChange={(e) => update("floors", e.target.value)}>
                  {range(1, 5).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Rooms" htmlFor="est-rooms" error={errors.rooms}>
                <SelectInput id="est-rooms" value={draft.rooms} onChange={(e) => update("rooms", e.target.value)}>
                  {range(1, 30).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Bathrooms" htmlFor="est-baths" error={errors.bathrooms}>
                <SelectInput id="est-baths" value={draft.bathrooms} onChange={(e) => update("bathrooms", e.target.value)}>
                  {range(0, 20).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </div>
        )}

        {step === 1 && draft.mode === "RENOVATION" && (
          <div className="space-y-5">
            <p className="text-sm text-ink-600">
              {SCOPE_LABELS[draft.scope]} in {draft.city}
            </p>
            <Field label="Area (sq ft)" htmlFor="est-area" error={errors.areaSqft} hint={scopeMeta.areaHint}>
              <TextInput
                id="est-area"
                inputMode="numeric"
                value={draft.areaSqft}
                onChange={(e) => update("areaSqft", e.target.value.replace(/[^\d]/g, ""))}
                placeholder="E.g. 60"
                invalid={Boolean(errors.areaSqft)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p id="tier-label" className="text-sm font-semibold text-ink-800">Construction quality</p>
            <Segmented
              label="Construction quality"
              options={TIER_OPTIONS}
              value={draft.tier}
              onChange={(v) => update("tier", v)}
            />
            <p className="text-sm text-ink-600">{TIER_HINTS[draft.tier].line}</p>
            {errors.tier && <p className="text-xs font-medium text-red-600">{errors.tier}</p>}
          </div>
        )}

        {step === REVIEW && (
          <div className="space-y-4">
            <Card className="p-4">
              <dl className="divide-y divide-ink-100 text-sm">
                <ReviewRow label="Project" value={draft.title.trim()} onEdit={() => goTo(0)} />
                <ReviewRow
                  label="Type"
                  value={draft.mode === "NEW_BUILD" ? SCOPE_LABELS.WHOLE_HOUSE : SCOPE_LABELS[draft.scope]}
                  onEdit={() => goTo(0)}
                />
                <ReviewRow label="City" value={draft.city} onEdit={() => goTo(0)} />
                <ReviewRow label="Details" value={safeSummary(draft)} onEdit={() => goTo(1)} />
                <ReviewRow label="Quality" value={TIER_LABELS[draft.tier]} onEdit={() => goTo(2)} />
              </dl>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink-900">Live estimate</h2>
                {previewLoading && <span className="text-xs text-ink-400" aria-live="polite">Calculating…</span>}
              </div>
              {previewError ? (
                <p className="mt-2 text-sm text-red-600">{previewError}</p>
              ) : (
                <div className={cn("mt-2 transition-opacity", previewLoading && "opacity-50")} aria-busy={previewLoading}>
                  {preview ? (
                    <>
                      <MoneyRow label="Materials" paise={preview.materialsPaise} />
                      <MoneyRow label="Labour" paise={preview.labourPaise} />
                      <MoneyRow label="Other costs" paise={preview.otherPaise} />
                      <div className="mt-2 flex items-baseline justify-between rounded-xl bg-trust-50 px-3.5 py-3">
                        <span className="text-sm font-semibold text-trust-700">Total estimated cost</span>
                        <Money paise={preview.totalPaise} className="text-xl font-bold text-ink-900" />
                      </div>
                    </>
                  ) : (
                    <div className="h-32 animate-pulse rounded-xl bg-ink-50" aria-hidden />
                  )}
                </div>
              )}
              <p className="mt-3 flex gap-2 text-xs leading-relaxed text-ink-500">
                <Info aria-hidden className="size-4 shrink-0 text-ink-400" />
                {ESTIMATE_DISCLAIMER}
              </p>
            </Card>

            {!signedIn && !editing && (
              <p className="text-center text-xs text-ink-500">
                You&apos;ll be asked to sign in to save this estimate — your answers are kept.
              </p>
            )}
          </div>
        )}

        <StickyBar className="md:mt-8">
          <div className="mx-auto flex max-w-2xl gap-3">
            {step > 0 && (
              <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} className="shrink-0">
                Back
              </Button>
            )}
            {step < REVIEW ? (
              <Button type="submit" variant="secondary" fullWidth>
                Next <ArrowRight aria-hidden className="size-4" />
              </Button>
            ) : (
              <Button type="submit" fullWidth loading={submitting} disabled={!cityAvailable}>
                {editing ? "Update estimate" : "Create estimate"}
              </Button>
            )}
          </div>
        </StickyBar>
      </form>
    </div>
  );
}

function safeSummary(d: Draft): string {
  const payload = toPayload(d);
  const parsed = (payload.mode === "NEW_BUILD" ? NewBuildInput : RenovationInput).safeParse(payload);
  return parsed.success ? inputsSummary(parsed.data) : "Incomplete";
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="w-20 shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words text-ink-900">{value}</dd>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label.toLowerCase()}`}
        className="-my-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-50 hover:text-brand-700"
      >
        <Pencil aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** A large radio-style card, per the mockup's "Create Project" type picker. */
function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  name,
  compact = false,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  name: string;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col items-center rounded-(--radius-card) border-2 bg-white text-center transition-colors",
        compact ? "min-h-20 justify-center gap-1.5 p-3" : "gap-2 p-4 pb-5",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600",
        selected ? "border-brand-500 bg-brand-50/60" : "border-ink-100 hover:border-ink-200",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span className={cn(selected ? "text-brand-600" : "text-ink-700")}>{icon}</span>
      <span className="text-sm font-bold text-ink-900">{title}</span>
      {subtitle && <span className="text-[11px] leading-snug text-ink-500">{subtitle}</span>}
      {!compact && (
        <span
          aria-hidden
          className={cn(
            "mt-1 flex size-6 items-center justify-center rounded-full border-2",
            selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200",
          )}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
      {compact && selected && (
        <Check aria-hidden className="absolute top-2 right-2 size-4 text-brand-600" strokeWidth={3} />
      )}
    </label>
  );
}

