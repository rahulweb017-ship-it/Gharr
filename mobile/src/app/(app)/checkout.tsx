import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@/shared/money";
import { addressApi, formatAddress } from "~/api/addresses";
import { cartApi, paymentApi } from "~/api/endpoints";
import type { CheckoutResult, PaymentMethod } from "~/api/types";
import { Body, Button, Card, ErrorView, Loading, Muted, Row, Screen, SectionTitle, TextField, errorMessage } from "~/components/ui";
import { CART_KEY, useCart } from "~/lib/cart";
import { colors, font, radius, space } from "~/theme";

const METHODS: { value: PaymentMethod; title: string; subtitle: string }[] = [
  { value: "COD", title: "Cash on delivery", subtitle: "Pay the seller when your order arrives" },
  { value: "UPI", title: "Pay online", subtitle: "UPI, card or netbanking" },
];

/** A fresh key per checkout attempt makes a double tap (or a retry after a timeout) place one order, not two. */
function newIdempotencyKey(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CheckoutScreen() {
  const queryClient = useQueryClient();
  const cart = useCart();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: addressApi.list });
  const [addressChoice, setAddressId] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  // The default address (listed first) is preselected until the user picks another.
  const addressId = addresses.data?.some((a) => a.id === addressChoice) ? addressChoice : addresses.data?.[0]?.id;

  const placeOrder = useMutation({
    mutationFn: () =>
      cartApi.checkout({
        addressId: addressId!,
        paymentMethod: method,
        customerNote: note.trim() || undefined,
        idempotencyKey: idempotencyKey.current,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: CART_KEY });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (result.paymentMethod === "COD") showOrders(result);
      else promptMockPayment(result);
    },
    onError: (err) => {
      setError(errorMessage(err));
      idempotencyKey.current = newIdempotencyKey();
    },
  });

  function showOrders(result: CheckoutResult) {
    if (result.orders.length === 1) {
      router.replace({ pathname: "/orders/[id]", params: { id: result.orders[0].id, placed: "1" } });
    } else {
      router.replace("/orders");
    }
  }

  /**
   * The online gateway is still the dev mock (PAYMENT_PROVIDER=mock); Razorpay
   * is not wired up server-side yet. This stands in for the gateway sheet.
   */
  function promptMockPayment(result: CheckoutResult) {
    const settle = async (outcome: "success" | "failure") => {
      try {
        await paymentApi.completeMock(result.paymentId, outcome);
      } catch (err) {
        Alert.alert("Payment", errorMessage(err));
      }
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      showOrders(result);
    };
    Alert.alert(
      "Test payment",
      `Pay ${formatINR(result.totalPaise)}? This is the development payment gateway — no money moves.`,
      [
        { text: "Fail payment", style: "destructive", onPress: () => void settle("failure") },
        { text: "Pay", onPress: () => void settle("success") },
      ],
      { cancelable: false },
    );
  }

  if (cart.isPending || addresses.isPending) return <Loading />;
  if (cart.isError) return <ErrorView error={cart.error} onRetry={cart.refetch} />;
  if (addresses.isError) return <ErrorView error={addresses.error} onRetry={addresses.refetch} />;

  const pricing = cart.data.pricing;

  return (
    <Screen>
      <SectionTitle>Deliver to</SectionTitle>
      {addresses.data.map((a) => (
        <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={[styles.option, a.id === addressId && styles.selected]}>
          <Radio on={a.id === addressId} />
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: "600" }}>
              {a.contactName} · {a.type.toLowerCase()}
            </Body>
            <Muted>{formatAddress(a)}</Muted>
          </View>
        </Pressable>
      ))}
      <Button
        title={addresses.data.length ? "Add another address" : "Add a delivery address"}
        variant={addresses.data.length ? "ghost" : "secondary"}
        icon="add"
        onPress={() => router.push({ pathname: "/account/addresses/[id]", params: { id: "new" } })}
        style={{ marginBottom: space.lg }}
      />

      <SectionTitle>Payment</SectionTitle>
      {METHODS.map((m) => (
        <Pressable key={m.value} onPress={() => setMethod(m.value)} style={[styles.option, m.value === method && styles.selected]}>
          <Radio on={m.value === method} />
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: "600" }}>{m.title}</Body>
            <Muted>{m.subtitle}</Muted>
          </View>
        </Pressable>
      ))}

      <TextField
        label="Note for the seller (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={500}
        multiline
        style={{ marginTop: space.md }}
      />

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Muted>{cart.data.items.length} items · {pricing.groups.length} seller(s)</Muted>
          <Text style={{ fontSize: font.lg, fontWeight: "700", color: colors.ink900 }}>{formatINR(pricing.totalPaise)}</Text>
        </Row>
        <Muted style={{ marginTop: 2 }}>Includes {formatINR(pricing.deliveryFeePaise)} delivery and {formatINR(pricing.taxPaise)} GST</Muted>
      </Card>

      {error ? <Text style={{ color: colors.danger600, marginBottom: space.md }}>{error}</Text> : null}
      <Button
        title={method === "COD" ? "Place order" : `Pay ${formatINR(pricing.totalPaise)}`}
        onPress={() => placeOrder.mutate()}
        loading={placeOrder.isPending}
        disabled={!addressId || cart.data.items.length === 0}
      />
    </Screen>
  );
}

function Radio({ on }: { on: boolean }) {
  return <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? colors.brand500 : colors.ink300} />;
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  selected: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
});
