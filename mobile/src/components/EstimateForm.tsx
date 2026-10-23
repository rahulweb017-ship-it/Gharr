import { useState } from "react";
import { Text } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EstimateInput } from "@/shared/contracts/estimate";
import { ESTIMATE_DISCLAIMER, SCOPE_LABELS, TIER_LABELS, type QualityTier } from "@/shared/estimate";
import { formatINR } from "@/shared/money";
import { ApiError } from "~/api/client";
import { estimateApi } from "~/api/endpoints";
import { colors, space } from "~/theme";
import { AmountRow, Body, Button, Card, Chip, Chips, Muted, Row, Screen, SectionTitle, TextField, errorMessage, styles as ui } from "./ui";

type Mode = "NEW_BUILD" | "RENOVATION";
type RenovationScope = "BATHROOM" | "KITCHEN" | "FLOORING" | "PAINTING";
const TIERS: QualityTier[] = ["BASIC", "STANDARD", "PREMIUM"];
const SCOPES: RenovationScope[] = ["BATHROOM", "KITCHEN", "FLOORING", "PAINTING"];
const NUMBER_FIELDS = ["plotSqft", "builtUpSqft", "floors", "rooms", "bathrooms", "areaSqft"] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];

/** Values from a saved estimate's `inputs`, used to prefill the edit screen. */
export type EstimateFormInitial = Partial<Record<NumberField, number>> & {
  mode?: Mode;
  title?: string;
  city?: string;
  tier?: QualityTier;
  scope?: RenovationScope;
};

/**
 * The estimate wizard, validated with the API's own EstimateInput contract.
 * "Preview" prices it without saving; "Save" hands the parsed input to `onSave`.
 */
export function EstimateForm({
  initial,
  saveLabel,
  saving,
  onSave,
}: {
  initial?: EstimateFormInitial;
  saveLabel: string;
  saving: boolean;
  onSave: (input: EstimateInput) => Promise<unknown>;
}) {
  const cities = useQuery({ queryKey: ["estimate-cities"], queryFn: estimateApi.cities });
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "NEW_BUILD");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [tier, setTier] = useState<QualityTier>(initial?.tier ?? "STANDARD");
  const [scope, setScope] = useState<RenovationScope>(initial?.scope ?? "BATHROOM");
  const [numbers, setNumbers] = useState<Record<NumberField, string>>(() => {
    const out = {} as Record<NumberField, string>;
    for (const key of NUMBER_FIELDS) out[key] = initial?.[key] !== undefined ? String(initial[key]) : "";
    return out;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const preview = useMutation({ mutationFn: estimateApi.preview });

  const setNumber = (key: NumberField) => (value: string) => {
    setNumbers((n) => ({ ...n, [key]: value.replace(/[^\d]/g, "") }));
    preview.reset();
  };

  function parse(): EstimateInput | null {
    const common = { title, city, tier };
    const raw =
      mode === "NEW_BUILD"
        ? {
            mode,
            ...common,
            plotSqft: numbers.plotSqft,
            builtUpSqft: numbers.builtUpSqft,
            floors: numbers.floors,
            rooms: numbers.rooms,
            bathrooms: numbers.bathrooms,
          }
        : { mode, ...common, scope, areaSqft: numbers.areaSqft };
    // A failed union reports both branches' issues; keep only the fields the
    // selected mode actually shows.
    const parsed = EstimateInput.safeParse(raw);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const fieldErrors: Record<string, string> = {};
    const issues = parsed.error.issues.flatMap((issue) =>
      issue.code === "invalid_union" ? issue.unionErrors.flatMap((e) => e.issues) : [issue],
    );
    const relevant = new Set(["title", "city", "tier", ...(mode === "NEW_BUILD" ? ["plotSqft", "builtUpSqft", "floors", "rooms", "bathrooms"] : ["scope", "areaSqft"])]);
    for (const issue of issues) {
      const field = String(issue.path[0]);
      if (relevant.has(field)) fieldErrors[field] ??= issue.message;
    }
    setErrors(fieldErrors);
    return null;
  }

  function runPreview() {
    const input = parse();
    if (input) preview.mutate(input, { onError: (err) => setErrors({ form: errorMessage(err) }) });
  }

  async function save() {
    const input = parse();
    if (!input) return;
    try {
      await onSave(input);
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fieldErrors, form: err.message } : { form: errorMessage(err) });
    }
  }

  const numberField = (key: NumberField, label: string, inRow = false) => (
    <TextField
      label={label}
      value={numbers[key]}
      onChangeText={setNumber(key)}
      keyboardType="number-pad"
      error={errors[key]}
      style={inRow ? { flex: 1 } : undefined}
    />
  );

  return (
    <Screen>
      <Chips style={{ marginBottom: space.lg }}>
        <Chip label="New construction" selected={mode === "NEW_BUILD"} onPress={() => (setMode("NEW_BUILD"), preview.reset())} />
        <Chip label="Renovation" selected={mode === "RENOVATION"} onPress={() => (setMode("RENOVATION"), preview.reset())} />
      </Chips>

      <TextField label="Project name" placeholder="e.g. Our house in Whitefield" value={title} onChangeText={setTitle} error={errors.title} />

      <SectionTitle>City</SectionTitle>
      <Chips scroll style={{ marginBottom: errors.city ? space.xs : space.lg }}>
        {(cities.data ?? []).map((c) => (
          <Chip key={c} label={c} selected={city === c} onPress={() => (setCity(c), preview.reset())} />
        ))}
      </Chips>
      {errors.city ? <Text style={[ui.error, { marginBottom: space.lg }]}>Choose a city</Text> : null}

      <SectionTitle>Quality</SectionTitle>
      <Chips style={{ marginBottom: space.lg }}>
        {TIERS.map((t) => (
          <Chip key={t} label={TIER_LABELS[t]} selected={tier === t} onPress={() => (setTier(t), preview.reset())} />
        ))}
      </Chips>

      {mode === "NEW_BUILD" ? (
        <>
          {numberField("plotSqft", "Plot size (sq ft)")}
          {numberField("builtUpSqft", "Built-up area, all floors (sq ft)")}
          <Row style={{ gap: space.md }}>
            {numberField("floors", "Floors", true)}
            {numberField("rooms", "Rooms", true)}
            {numberField("bathrooms", "Bathrooms", true)}
          </Row>
        </>
      ) : (
        <>
          <SectionTitle>What are you renovating?</SectionTitle>
          <Row style={{ flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
            {SCOPES.map((s) => (
              <Chip key={s} label={SCOPE_LABELS[s]} selected={scope === s} onPress={() => (setScope(s), preview.reset())} />
            ))}
          </Row>
          {numberField("areaSqft", scope === "PAINTING" ? "Floor area to paint (sq ft)" : "Area (sq ft)")}
        </>
      )}

      {preview.data ? (
        <Card style={{ borderColor: colors.brand500 }}>
          <Muted>Estimated cost</Muted>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.ink900 }}>{formatINR(preview.data.totalPaise)}</Text>
          <AmountRow label="Materials" paise={preview.data.materialsPaise} />
          <AmountRow label="Labour" paise={preview.data.labourPaise} />
          <AmountRow label="Other" paise={preview.data.otherPaise} />
          <Muted style={{ marginTop: space.sm }}>{ESTIMATE_DISCLAIMER}</Muted>
        </Card>
      ) : null}

      {errors.form ? <Body style={{ color: colors.danger600, marginBottom: space.md }}>{errors.form}</Body> : null}
      <Button title="Preview cost" variant="secondary" onPress={runPreview} loading={preview.isPending} style={{ marginBottom: space.md }} />
      <Button title={saveLabel} onPress={save} loading={saving} />
    </Screen>
  );
}

