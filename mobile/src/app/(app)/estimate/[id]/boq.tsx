import { useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { UNIT_META, snapQuantity } from "@/shared/units";
import { estimateApi } from "~/api/endpoints";
import type { BoqItem } from "~/api/types";
import { ProductImage } from "~/components/commerce";
import { Body, Button, Card, EmptyState, ErrorView, Loading, Muted, Row, Stepper, errorMessage } from "~/components/ui";
import { CART_KEY } from "~/lib/cart";
import { colors, space } from "~/theme";

type Available = Extract<BoqItem, { available: true }>;

/** An estimate's materials matched to the cheapest live offers, ready to send to the cart. */
export default function BoqScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const boq = useQuery({ queryKey: ["estimate", id, "boq"], queryFn: () => estimateApi.boq(id) });
  // Overrides of the suggested pack counts, and lines the user unticked.
  const [packs, setPacks] = useState<Record<string, number>>({});
  const [unticked, setUnticked] = useState<Record<string, boolean>>({});

  const addToCart = useMutation({
    mutationFn: (items: { lineId: string; quantity: number }[]) => estimateApi.addToCart(id, { items }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: CART_KEY });
      const failed = result.failed.map((f) => `• ${f.label}: ${f.reason}`).join("\n");
      Alert.alert(
        `${result.added.length} item${result.added.length === 1 ? "" : "s"} added to cart`,
        failed ? `Couldn't add:\n${failed}` : undefined,
        [
          { text: "Stay here", style: "cancel" },
          { text: "Go to cart", onPress: () => router.push("/cart") },
        ],
      );
    },
    onError: (err) => Alert.alert("Couldn't add to cart", errorMessage(err)),
  });

  if (boq.isPending) return <Loading />;
  if (boq.isError) return <ErrorView error={boq.error} onRetry={boq.refetch} />;

  const items = boq.data.items;
  const chosen = items.filter((i): i is Available => i.available && !unticked[i.lineId]);
  const total = chosen.reduce((sum, i) => sum + Math.round(i.offer.pricePaise * (packs[i.lineId] ?? i.packs)), 0);

  if (!items.length) {
    return <EmptyState icon="list-outline" title="Nothing to buy yet" message="None of this estimate's materials are linked to catalogue products." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.lineId}
        contentContainerStyle={{ padding: space.lg }}
        ListHeaderComponent={
          <Muted style={{ marginBottom: space.md }}>
            Quantities are rounded up to whole packs from the cheapest in-stock seller in {boq.data.city}. Adjust before adding.
          </Muted>
        }
        renderItem={({ item }) => {
          if (!item.available) {
            return (
              <Card style={{ opacity: 0.6 }}>
                <Body style={{ fontWeight: "600" }}>{item.label}</Body>
                <Muted>Not available to buy right now · estimated {formatINR(item.estimatedPaise)}</Muted>
              </Card>
            );
          }
          const count = packs[item.lineId] ?? item.packs;
          const on = !unticked[item.lineId];
          const rules = { moq: item.offer.moq, step: item.offer.step, max: item.offer.max, unit: item.offer.unit };
          return (
            <Card style={on ? undefined : { opacity: 0.7 }}>
              <Row style={{ gap: space.md, alignItems: "flex-start" }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setUnticked((u) => ({ ...u, [item.lineId]: on }))}
                  hitSlop={8}
                >
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={24} color={on ? colors.brand500 : colors.ink300} />
                </Pressable>
                <ProductImage uri={item.offer.imageUrl} size={52} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600" }}>{item.label}</Body>
                  <Muted numberOfLines={1}>
                    {item.offer.productName} · {item.offer.packLabel}
                  </Muted>
                  <Muted>
                    {item.offer.vendorName} · {formatINR(item.offer.pricePaise)}/{UNIT_META[item.offer.unit].short}
                  </Muted>
                </View>
              </Row>
              <Row style={{ justifyContent: "space-between", marginTop: space.md }}>
                <Stepper
                  value={count}
                  step={item.offer.step}
                  min={item.offer.moq}
                  format={(n) => `${n} ${UNIT_META[item.offer.unit].short}`}
                  onChange={(n) => setPacks((p) => ({ ...p, [item.lineId]: snapQuantity(n, rules) }))}
                />
                <Body style={{ fontWeight: "700" }}>{formatINR(Math.round(item.offer.pricePaise * count))}</Body>
              </Row>
            </Card>
          );
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.white, padding: space.lg, paddingBottom: space.md }}>
        <Button
          title={chosen.length ? `Add ${chosen.length} to cart · ${formatINR(total)}` : "Select items to add"}
          disabled={!chosen.length}
          loading={addToCart.isPending}
          onPress={() => addToCart.mutate(chosen.map((i) => ({ lineId: i.lineId, quantity: packs[i.lineId] ?? i.packs })))}
        />
      </SafeAreaView>
    </View>
  );
}
