import { Alert, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { formatPhone } from "@/shared/phone";
import { formatQuantity } from "@/shared/units";
import { formatAddress } from "~/api/addresses";
import { orderApi } from "~/api/endpoints";
import { ProductImage } from "~/components/commerce";
import { AmountRow, Badge, Body, Button, Card, ErrorView, Loading, Muted, Row, Screen, SectionTitle, errorMessage, styles as ui } from "~/components/ui";
import { ORDER_STATUS, formatDateTime } from "~/lib/format";
import { colors, space } from "~/theme";

const PAYMENT_LABEL: Record<string, string> = { COD: "Cash on delivery", OFFLINE_MOCK: "Test payment" };

export default function OrderScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const queryClient = useQueryClient();
  const order = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderApi.get(id),
    // Right after an online payment the webhook may still be landing.
    refetchInterval: (query) => (query.state.data?.status === "PENDING_PAYMENT" ? 3000 : false),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => orderApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => Alert.alert("Couldn't cancel", errorMessage(err)),
  });

  if (order.isPending) return <Loading />;
  if (order.isError) return <ErrorView error={order.error} onRetry={order.refetch} />;

  const o = order.data;
  const status = ORDER_STATUS[o.status];
  const canCancel = o.availableActions.some((a) => a.to === "CANCELLED" && a.roles.includes("CUSTOMER"));

  function confirmCancel() {
    Alert.alert("Cancel this order?", "Any online payment will be refunded to the original method.", [
      { text: "Keep order", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: () => cancel.mutate("Cancelled by customer from the app") },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: o.orderNumber }} />
      {placed === "1" && o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" ? (
        <Card style={{ backgroundColor: colors.trust50, borderColor: colors.trust50 }}>
          <Body style={{ fontWeight: "700", color: colors.trust600 }}>Order placed</Body>
          <Muted>We’ve sent it to {o.vendor.businessName}.</Muted>
        </Card>
      ) : null}

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Badge label={status.label} tone={status.tone} />
          <Muted>{formatDateTime(o.placedAt)}</Muted>
        </Row>
        <Body style={{ fontWeight: "600", marginTop: space.sm }}>{o.vendor.businessName}</Body>
        <Muted>Seller phone {formatPhone(o.vendor.phoneE164)}</Muted>
        {o.cancelReason ? <Muted style={{ marginTop: space.xs }}>Reason: {o.cancelReason}</Muted> : null}
      </Card>

      <SectionTitle>Items</SectionTitle>
      <Card>
        {o.items.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={ui.divider} /> : null}
            <Row style={{ gap: space.md }}>
              <ProductImage uri={item.imageUrl} size={48} />
              <View style={{ flex: 1 }}>
                <Body numberOfLines={2}>{item.productName}</Body>
                <Muted>
                  {item.variantLabel} · {formatQuantity(item.quantity, item.unit)} × {formatINR(item.unitPricePaise)}
                </Muted>
              </View>
              <Body style={{ fontWeight: "600" }}>{formatINR(item.lineTotalPaise)}</Body>
            </Row>
          </View>
        ))}
      </Card>

      <Card>
        <AmountRow label="Items" paise={o.itemsSubtotalPaise} />
        <AmountRow label="Delivery" paise={o.deliveryFeePaise} />
        {o.discountPaise > 0 ? <AmountRow label="Discount" paise={-o.discountPaise} /> : null}
        <AmountRow label="GST" paise={o.taxPaise} />
        <View style={ui.divider} />
        <AmountRow label="Total" paise={o.totalPaise} bold />
        <Muted style={{ marginTop: space.xs }}>
          {PAYMENT_LABEL[o.paymentMethod] ?? "Paid online"}
          {o.payment ? ` · ${o.payment.status.toLowerCase().replace(/_/g, " ")}` : ""}
        </Muted>
      </Card>

      <SectionTitle>Delivery address</SectionTitle>
      <Card>
        <Body style={{ fontWeight: "600" }}>{o.deliveryAddress.contactName}</Body>
        <Muted>{formatAddress(o.deliveryAddress)}</Muted>
      </Card>

      {o.events.length > 0 ? (
        <>
          <SectionTitle>Timeline</SectionTitle>
          <Card>
            {o.events.map((e) => (
              <Row key={e.id} style={{ justifyContent: "space-between", paddingVertical: 3 }}>
                <Text style={{ color: colors.ink900 }}>{ORDER_STATUS[e.toStatus].label}</Text>
                <Muted>{formatDateTime(e.createdAt)}</Muted>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {canCancel ? <Button title="Cancel order" variant="danger" onPress={confirmCancel} loading={cancel.isPending} /> : null}
    </Screen>
  );
}
