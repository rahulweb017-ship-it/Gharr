import { Alert, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BUCKET_LABELS, ESTIMATE_DISCLAIMER, SCOPE_LABELS, TIER_LABELS, shareOfTotal, type EstimateBucket } from "@/shared/estimate";
import { formatINR } from "@/shared/money";
import { UNIT_META } from "@/shared/units";
import { estimateApi } from "~/api/endpoints";
import { AmountRow, Body, Button, Card, ErrorView, Loading, Muted, Row, Screen, SectionTitle, errorMessage } from "~/components/ui";
import { colors, radius, space } from "~/theme";

const BUCKETS: EstimateBucket[] = ["MATERIALS", "LABOUR", "OTHER"];
const BUCKET_COLOR: Record<EstimateBucket, string> = { MATERIALS: colors.brand500, LABOUR: colors.ink900, OTHER: colors.ink300 };

export default function EstimateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const estimate = useQuery({ queryKey: ["estimate", id], queryFn: () => estimateApi.get(id) });
  const remove = useMutation({
    mutationFn: () => estimateApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      router.back();
    },
    onError: (err) => Alert.alert("Couldn't delete", errorMessage(err)),
  });

  if (estimate.isPending) return <Loading />;
  if (estimate.isError) return <ErrorView error={estimate.error} onRetry={estimate.refetch} />;
  const e = estimate.data;
  const totals: Record<EstimateBucket, number> = { MATERIALS: e.materialsPaise, LABOUR: e.labourPaise, OTHER: e.otherPaise };

  function confirmDelete() {
    Alert.alert("Delete this estimate?", e.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: e.title }} />
      <Card>
        <Muted>
          {SCOPE_LABELS[e.scope]} · {TIER_LABELS[e.tier]} · {e.city}
        </Muted>
        <Text style={{ fontSize: 32, fontWeight: "800", color: colors.ink900, marginVertical: space.xs }}>{formatINR(e.totalPaise)}</Text>
        {/* Proportion bar: materials / labour / other. */}
        <View style={{ flexDirection: "row", height: 10, borderRadius: radius.pill, overflow: "hidden", marginVertical: space.sm }}>
          {BUCKETS.map((b) => (
            <View key={b} style={{ flex: Math.max(totals[b], 0), backgroundColor: BUCKET_COLOR[b] }} />
          ))}
        </View>
        {BUCKETS.map((b) => (
          <Row key={b} style={{ justifyContent: "space-between", paddingVertical: 2 }}>
            <Row style={{ gap: space.sm }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: BUCKET_COLOR[b] }} />
              <Body>{BUCKET_LABELS[b]}</Body>
            </Row>
            <Body>
              {formatINR(totals[b])} <Muted>({shareOfTotal(totals[b], e.totalPaise)}%)</Muted>
            </Body>
          </Row>
        ))}
      </Card>

      <Button title="Buy materials (bill of quantities)" icon="cart-outline" onPress={() => router.push({ pathname: "/estimate/[id]/boq", params: { id } })} />
      <Row style={{ gap: space.md, marginTop: space.md, marginBottom: space.lg }}>
        <Button title="Edit" variant="secondary" icon="create-outline" onPress={() => router.push({ pathname: "/estimate/[id]/edit", params: { id } })} style={{ flex: 1 }} />
        <Button title="Delete" variant="danger" icon="trash-outline" onPress={confirmDelete} loading={remove.isPending} style={{ flex: 1 }} />
      </Row>

      {BUCKETS.map((bucket) => {
        const lines = e.lines.filter((l) => l.bucket === bucket);
        if (!lines.length) return null;
        return (
          <View key={bucket}>
            <SectionTitle>{BUCKET_LABELS[bucket]}</SectionTitle>
            <Card>
              {lines.map((line) => (
                <View key={line.id ?? line.itemKey} style={{ paddingVertical: space.xs }}>
                  <AmountRow label={line.label} paise={line.amountPaise} />
                  {line.unit ? (
                    <Muted>
                      {line.quantity} {UNIT_META[line.unit].short} × {formatINR(line.unitPricePaise)}
                    </Muted>
                  ) : null}
                </View>
              ))}
            </Card>
          </View>
        );
      })}
      <Muted>{ESTIMATE_DISCLAIMER}</Muted>
    </Screen>
  );
}
