import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { formatINR } from "@/shared/money";
import { formatQuantity, snapQuantity } from "@/shared/units";
import { cartApi } from "~/api/endpoints";
import type { CartItem, CartView } from "~/api/types";
import { ProductImage } from "~/components/commerce";
import { AmountRow, Body, Button, Card, EmptyState, ErrorView, KEYBOARD_GAP, Loading, Muted, Price, Row, Stepper, errorMessage, styles as ui } from "~/components/ui";
import { useCart, useCartMutation } from "~/lib/cart";
import { colors, font, space } from "~/theme";

export default function CartScreen() {
  const cart = useCart();

  if (cart.isPending) return <Loading />;
  if (cart.isError) return <ErrorView error={cart.error} onRetry={cart.refetch} />;
  if (cart.data.items.length === 0) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Your cart is empty"
        message="Add materials from the shop, or send an estimate's bill of quantities here."
        action={<Button title="Browse materials" onPress={() => router.replace("/shop")} />}
      />
    );
  }
  return <CartContents cart={cart.data} refreshing={cart.isRefetching} onRefresh={cart.refetch} />;
}

function CartContents({ cart, refreshing, onRefresh }: { cart: CartView; refreshing: boolean; onRefresh: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const update = useCartMutation((a: { id: string; quantity: number }) => cartApi.updateItem(a.id, a.quantity));
  const remove = useCartMutation((id: string) => cartApi.removeItem(id));
  const onError = { onError: (err: unknown) => setError(errorMessage(err)), onSuccess: () => setError(null) };

  const vendorName = (id: string) => cart.vendors.find((v) => v.id === id)?.businessName ?? "Seller";
  const issueFor = (itemId: string) => cart.issues.find((i) => i.itemId === itemId)?.message;
  const blocked = cart.issues.length > 0 || cart.pricing.groups.some((g) => g.belowMinimum);

  function confirmRemove(item: CartItem) {
    Alert.alert("Remove item?", item.product.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate(item.id, onError) },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={cart.items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: space.lg }}
        keyboardShouldPersistTaps="handled"
        // The coupon field sits in the footer; keep it above the keyboard.
        renderScrollComponent={(props) => <KeyboardAwareScrollView {...props} bottomOffset={KEYBOARD_GAP} />}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => {
          const rules = { moq: item.moqQuantity, step: item.stepQuantity, max: item.maxOrderQuantity, unit: item.unit };
          const issue = issueFor(item.id);
          return (
            <Card style={!item.isAvailable && { opacity: 0.6 }}>
              <Row style={{ gap: space.md, alignItems: "flex-start" }}>
                <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: item.product.slug } })}>
                  <ProductImage uri={item.product.images[0]} size={64} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600" }} numberOfLines={2}>
                    {item.product.name}
                  </Body>
                  <Muted>
                    {item.variantLabel} · {item.vendor.businessName}
                  </Muted>
                  <Row style={{ gap: space.sm, marginTop: 2 }}>
                    <Price paise={Math.round(item.pricePaise * item.quantity)} />
                    <Muted>
                      ({formatINR(item.pricePaise)} × {formatQuantity(item.quantity, item.unit)})
                    </Muted>
                  </Row>
                </View>
                <Pressable accessibilityLabel="Remove" onPress={() => confirmRemove(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.ink400} />
                </Pressable>
              </Row>
              {issue ? <Text style={styles.issue}>{issue}</Text> : null}
              <Row style={{ marginTop: space.md }}>
                <Stepper
                  value={item.quantity}
                  step={item.stepQuantity}
                  min={item.moqQuantity}
                  format={(n) => formatQuantity(n, item.unit)}
                  onChange={(n) => update.mutate({ id: item.id, quantity: snapQuantity(n, rules) }, onError)}
                />
              </Row>
            </Card>
          );
        }}
        ListFooterComponent={
          <>
            <CouponBox cart={cart} />
            <Card>
              <AmountRow label="Items" paise={cart.pricing.itemsSubtotalPaise} />
              <AmountRow label="Delivery" paise={cart.pricing.deliveryFeePaise} zeroLabel="Free" />
              {cart.pricing.discountPaise > 0 ? (
                <AmountRow label={`Coupon ${cart.pricing.couponCode ?? ""}`} paise={-cart.pricing.discountPaise} />
              ) : null}
              <AmountRow label="GST" paise={cart.pricing.taxPaise} />
              <View style={ui.divider} />
              <AmountRow label="Total" paise={cart.pricing.totalPaise} bold />
              {cart.pricing.totalSavingsPaise > 0 ? (
                <Text style={styles.savings}>You save {formatINR(cart.pricing.totalSavingsPaise)}</Text>
              ) : null}
            </Card>
            {cart.pricing.groups
              .filter((g) => g.belowMinimum)
              .map((g) => (
                <Text key={g.vendorId} style={styles.issue}>
                  {vendorName(g.vendorId)} needs a minimum order of {formatINR(g.belowMinimum!.minOrderPaise)} — add{" "}
                  {formatINR(g.belowMinimum!.shortfallPaise)} more.
                </Text>
              ))}
            {cart.pricing.groups.length > 1 ? (
              <Muted style={{ marginTop: space.sm }}>
                Items from {cart.pricing.groups.length} sellers arrive as separate deliveries.
              </Muted>
            ) : null}
            {error ? <Text style={styles.issue}>{error}</Text> : null}
          </>
        }
      />
      <SafeAreaView edges={["bottom"]} style={styles.bar}>
        <Button
          title={`Checkout · ${formatINR(cart.pricing.totalPaise)}`}
          onPress={() => router.push("/checkout")}
          disabled={blocked}
        />
      </SafeAreaView>
    </View>
  );
}

function CouponBox({ cart }: { cart: CartView }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const apply = useCartMutation((c: string) => cartApi.applyCoupon(c));
  const clear = useCartMutation((_: void) => cartApi.removeCoupon());

  if (cart.pricing.couponCode) {
    return (
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Body>
            Coupon <Text style={{ fontWeight: "700" }}>{cart.pricing.couponCode}</Text> applied
          </Body>
          <Button title="Remove" variant="ghost" onPress={() => clear.mutate()} loading={clear.isPending} />
        </Row>
      </Card>
    );
  }
  return (
    <Card>
      <Row style={{ gap: space.sm }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Coupon code"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          placeholderTextColor={colors.ink300}
          style={[ui.input, { flex: 1 }]}
        />
        <Button
          title="Apply"
          variant="secondary"
          disabled={code.trim().length < 3}
          loading={apply.isPending}
          onPress={() =>
            apply.mutate(code.trim(), {
              onSuccess: () => {
                setCode("");
                setError(null);
              },
              onError: (err) => setError(errorMessage(err)),
            })
          }
        />
      </Row>
      {error || cart.pricing.couponError ? <Text style={styles.issue}>{error ?? cart.pricing.couponError}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  issue: { color: colors.danger600, fontSize: font.sm, marginTop: space.sm },
  savings: { color: colors.trust600, fontSize: font.sm, marginTop: space.xs, fontWeight: "600" },
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.ink100,
    padding: space.lg,
    paddingBottom: space.md,
  },
});
